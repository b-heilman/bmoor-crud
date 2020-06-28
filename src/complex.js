
const {create} = require('bmoor/src/lib/error.js');

const {Schema} = require('./schema.js');
const {Network} = require('./graph/Network.js');
const {Path} = require('./graph/path.js');

async function addStuff(ref, structure, accessor, prev, count){
	if (!structure.tables[accessor.model]){
		const table = {
			name: accessor.model,
			series: accessor.series || accessor.model,
			schema: (await ref.nexus.loadModel(accessor.model)).schema,
			fields: []
		};

		structure.tables[accessor.model] = table;
		structure.refs[accessor.model] = [table];
	}

	if (prev){
		if (accessor.target){
			ref.setConnection(accessor.model, prev.model, accessor.target);
		} else {
			ref.setConnection(prev.model, accessor.model, prev.field);
		}
	}

	return count;
}

class Complex extends Schema {
	constructor(nexus){
		super();

		this.nexus = nexus;
		this.connections = {};
		this.aliases = {};
	}

	async addField(path, modelName, external, settings={}){
		const model = await this.nexus.loadModel(modelName);
		const field = model.getField(external);

		if (!field){
			throw create(`Complex, unknown field: ${modelName}.${external}`, {
				code: 'BMOOR_CRUD_COMPLEX_UNKNOWN',
				context: {
					path,
					modelName,
					external
				}
			});
		}

		const temp = Object.create(field);

		if (settings.series){
			temp.series = settings.series;
		}

		temp.alias = modelName+'_'+this.fields.length;
		temp.external = path;

		this.aliases[temp.alias] = field;

		return super.addField(temp);
	}

	async setConnection(baseModel, targetModel, local=null, settings={}){
		let baseSeries = null;
		let targetSeries = null;

		let relationship = this.nexus.mapper.getRelationship(
			baseModel, targetModel, local
		);

		if (!relationship){
			throw new Error(
				'unable to connect '+baseModel+' to '+targetModel+
				(local ? ' via '+local : '')
			);
		}

		// I only want outgoing relationships
		if (relationship.metadata.direction === 'outgoing'){
			baseSeries = settings.baseSeries || baseModel;
			targetSeries = settings.targetSeries || targetModel;
		} else {
			// so flip it
			baseSeries = settings.targetSeries || targetModel;
			targetSeries = settings.baseSeries || baseModel;

			relationship = this.nexus.mapper.getRelationship(
				targetModel, baseModel, relationship.remote
			);
		}

		let hub = this.connections[baseSeries];
		
		if (!hub){
			hub = [];
			this.connections[baseSeries] = hub;
		}

		const connection = Object.create(relationship);
		connection.name = targetSeries;

		hub.push(connection);
	}

	// produces representation for interface layer
	async getQuery(queries={}, settings={}, ctx={}){ // TODO
		const structure = this.fields.reduce(
			(agg, field) => {
				const series = field.series || field.model.name;

				if (!agg.tables[series]){  
					// create two indexes, one to reduce duplicates, one to use later
					const table = {
						name: field.model.name,
						series: series,
						schema: field.model.schema,
						fields: [],
						query: null
					};

					agg.tables[series] = table;

					if (!agg.refs[table.name]){
						agg.refs[table.name] = [];
					}

					agg.refs[table.name].push(table);
				}

				return agg;
			}, {
				tables: {},
				refs: {}
			}
		);

		// create a temp object, add any tables needed for queries
		let queryCount = 0;
		await Object.keys(queries)
		.reduce(
			async (prom, path) => {
				// TODO: clean this up once accessors have series defined
				await prom;
				
				const value = queries[path];
				const access = (new Path(path)).access;

				const mountAccessor = access[access.length-1];
				const mountSeries = mountAccessor.series || mountAccessor.model;

				const mount = structure.tables[mountSeries];
				if (!mount){
					throw new Error(`unable to mount: ${mountSeries} from ${path}`);
				}

				await access.reduce(
					async (prev, subAccessor) => {
						prev = await prev;
						queryCount = await addStuff(this, structure, subAccessor, prev, queryCount);
						
						return subAccessor;
					}, 
					Promise.resolve(null)
				);
				
				const rootAccessor = access[0];
				const rootSeries = rootAccessor.series || rootAccessor.model;
				const root = structure.tables[rootSeries];

				if (!root){
					throw new Error('unable to connect: '+path);
				}

				if (!root.query){
					root.query = {};
				}

				// So, if you write a query... you shoud use @notation for incoming property
				// if incase they don't, I allow a failback to field.  It isn't ideal, but it's
				// flexible.  Use the target incase I decide to change my mind in the future
				root.query[rootAccessor.target||rootAccessor.field] = value;
			}, 
			Promise.resolve(true)
		);

		this.build();

		const dex = (await this.testFields('read', ctx))
		.reduce(
			(agg, field) => {
				const series = field.series || field.model.name;
				
				agg.tables[series].fields.push({
					path: field.internal,
					as: field.alias || null
				});

				return agg;
			},
			// I want a base object with all the tables, so a table isn't dropped if a field isn't allowed
			structure
		);

		const tables = Object.values(dex.tables);
		if (tables.length > 1){
			const reqs = (new Network(this.nexus.mapper)).anchored(
				tables.map(table => table.name), 1
			);
			
			const loaded = {};
			const delegated = {};
			// use this order so tables are defined where how they join in, tables
			// without joins go first this way
			return reqs.reduce((agg, link) => {
				// a table can be referenced by multiple things, so one table, multiple series...
				// think an item having a creator and owner
				dex.refs[link.name]
				.forEach(table => {
					// this.connection is a directed graph, which is fine unless
					// we have the pattern 2 <- 1 <- 2 and we end up with two tables
					// not being joined correctly.  The idea is to hoist the primary node
					// to the front and delegate he connections to the other tables
					const connections = [].concat(
						this.connections[table.series] || [],
						delegated[table.series] || []
					);
					
					if (connections.length && !table.join){
						const joins = connections.reduce(
							(agg, connection) => {
								// if the table we're joining to has already been loaded
								// connect, otherwise delegate the connection
								if (loaded[connection.name]){
									agg.push({
										local: connection.local,
										name: connection.name,
										remote: connection.remote
									});
								} else {
									let group = delegated[connection.name];

									if (!group){
										group = [];

										delegated[connection.name] = group;
									}

									// flip the connection, this should be ok
									group.push({
										local: connection.remote,
										name: table.series,
										remote: connection.local
									});
								}

								return agg;
							},
							[]
						);

						if (joins.length){
							table.join = {
								on: joins
							};
						}
					}

					loaded[table.series] = true;

					agg.models.push(table);
				});

				return agg;
			}, {
				method: 'read',
				models: []
			});
		} else {
			return {
				method: 'read',
				models: [
					tables[0]
				]
			};
		}
	}

	getInflater(ctx){
		this.build();

		const inflater = this.actions.inflate;

		return function complexInflate(datum){
			return inflater(datum, ctx);
		};
	}

	getDeflater(ctx){
		this.build();

		const deflater = this.actions.deflate;
		
		return function complexDeflate(datum){
			return deflater(datum, ctx);
		};
	}
}

module.exports = {
	Complex
};
