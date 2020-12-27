
const {implode} = require('bmoor/src/object.js');
const {create} = require('bmoor/src/lib/error.js');

const {Structure} = require('./structure.js');
const {Network} = require('../graph/Network.js');
const {Path, pathToAccessors} = require('../graph/path.js');

// this works because of root, since it's expected two instances of the same table will
// be linked to via different variables.  I don't have any way of self defining aliases
// so .ownerId > $user is different from .creatorId > $user, but $user is not aliases
function knownSeries(context, accessor){
	return !!context.aliases[accessor.root];
}

function getSeries(context, accessor){
	const names = context.names;
	const aliases = context.aliases;

	if (!knownSeries(context, accessor)){
		let name = accessor.alias || accessor.model;
		let count = names[name];

		if (!count){
			// first one gets the real name
			names[name] = 1;
		} else {
			// if you didn't define a series for it, you must not care
			// to link into it
			name += '_'+count;
			names[name] = count + 1;
		}

		aliases[accessor.root] = name;
	}

	return aliases[accessor.root];
}

function linkSeries(composite, prev, accessor){
	const context = composite.context;
	const aliases = context.aliases;

	let series = aliases[accessor.root];
	if (!knownSeries(context, accessor)){
		series = getSeries(context, accessor);
		aliases[accessor.root] = series;

		if (prev){
			composite.setConnection(prev.model, accessor.model, prev.field, {
				baseSeries: prev.series,
				targetSeries: series,
				optional: accessor.optional
			});
		}
	}

	accessor.series = series;

	return series;
}

// this builds the context....
async function addStuff(composite, prev, accessor){
	const context = composite.context;

	if (!context.tables[accessor.model]){
		const table = {
			name: accessor.model,
			series: accessor.series || accessor.model,
			schema: (await composite.nexus.loadModel(accessor.model)).schema,
			fields: []
		};

		context.tables[accessor.model] = table;
		context.refs[accessor.model] = [table];
	}

	if (prev){
		if (accessor.target){
			composite.setConnection(accessor.model, prev.model, accessor.target);
		} else {
			composite.setConnection(prev.model, accessor.model, prev.field);
		}
	}
}

// used to parse appart the paths that can be fed into a composite schema
class CompositeProperties {
	constructor(schema, baseModel){
		this.model = baseModel;

		// break this into
		// [path]: [accessor]
		const imploded = implode(schema);

		this.variables = {};
		this.content = Object.keys(imploded).map(
			(mount) => {
				let statement = imploded[mount];

				if (statement !== '='){
					statement = '$'+baseModel + statement;
				}

				// if it's an = statement, the properties can't be short hand
				const accessors = pathToAccessors(statement); // this is an array of action tokens
				
				const action = accessors[accessors.length-1];

				const isArray = mount.indexOf('[0]') !== -1;

				const base = mount.substring(0, isArray ? mount.length-3 : mount.length);

				// TODO: I can do some kind of validation here?
				// TODO: shared variables, I want to treat these literal fields different from
				//   include fields or fields from a function.  Think the higher level function
				//   needs to track which references are added
				
				return {
					type: action.loader,
					isArray,
					base,
					statement,
					mountPoint: mount,
					accessors,
					expressor: null
				};
			}
		);
		
	}

	extend(properties){
		this.content = this.content.concat(
			properties.content.map(
				property => {
					const accessors = property.accessors.slice(0);

					if (property.type !== 'method'){
						if (this.model !== properties.model){
							accessors.unshift({
								loader: 'include',
								model: this.model,
								field: null,
								target: null,
								optional: false
							});
						}

						return {
							type: property.type,
							isArray: property.isArray,
							base: property.base,
							statement: property.statement,
							mountPoint: property.mountPoint,
							accessors,
							expressor: null
						};
					}
				}
			)
		);
	}

	calculateRoots(){
		for (const property of this.content){
			let root = '';

			for (const accessor of property.accessors){
				if (root){
					root += ':';
				}

				root += accessor.model;

				accessor.root = root;

				if (accessor.field){
					root += '.'+accessor.field;
				}
			}
		}
	}

	getVariables(){
		//[variable]

		// get all the raw fields
		
		// get everything you need for include queries
		
		// get all method variables
	}

	getExpressions(){
		//[path]: [expressor]

		// return back an array of methods which, when run against datum of 'references'
		// will convert into target shape
	}
}

class Composite extends Structure {
	/***
	 * {
	 *  nexus,
	 *  fields,
	 *  extends
	 * }
	 ***/
	async configure(settings){
		await super.configure(settings);

		this.nexus = settings.nexus;

		this.context = null;
		this.connections = {};
		this.properties = new CompositeProperties(
			settings.fields,
			settings.base
		);
	}

	assignField(field, settings){
		// I don't think I need this anymore?
		// this.references[field.reference] = field;

		return super.assignField(field, settings);
	}

	defineField(path, settings={}){
		if (!settings.field){
			console.log('complex: failed to define', path, settings);
			throw new Error(`Attempting to define complex field without a base: ${path}`);
		}

		const modelName = settings.model;
		const reference = settings.reference;

		// let's overload the other field's settings
		const fieldSettings = {};

		fieldSettings.series = settings.series || settings.model;

		// this can be moved to structure
		fieldSettings.reference = reference || (modelName+'_'+this.fields.length);

		return settings.field.extend(path, fieldSettings);
	}

	async addField(path, settings={}){
		const modelName = settings.model;
		const reference = settings.extends;

		const model = await this.nexus.loadModel(modelName);
		const field = model.getField(reference);

		if (!field){
			throw create(`Complex, unknown field: ${modelName}.${reference}`, {
				code: 'BMOOR_CRUD_COMPLEX_UNKNOWN',
				context: {
					path,
					modelName,
					reference
				}
			});
		}

		settings.field = field;

		return super.addField(path, settings);
	}

	// connects all the models and all the fields
	async link(){
		if (this.references){
			return;
		}

		const context = {
			refs: {},
			names: {},
			tables: {},
			aliases: {}
		};
		this.context = context;

		const settings = this.settings;
		
		let ext = settings.extends;
		if (ext){
			const parent = await this.nexus.loadComposite(ext);

			await parent.link();
			
			this.properties.extend(parent.properties);

			if (!settings.getChangeType){
				settings.getChangeType = parent.settings.getChangeType;
			}

			if (!settings.onChange){
				settings.onChange = parent.settings.onChange;
			}
		}

		this.properties.calculateRoots();

		if (this.properties.content.length === 0){
			throw new Error('No properties found');
		}

		// let's go through all the properties and figure out what is a field and 
		// a foreign reference
		const results = this.properties.content
		.map(async (property) => {
			const path = property.mountPoint;
			const accessors = property.accessors.slice(0);

			if (property.type === 'access'){
				let series = null;

				accessors.reduce(
					(prev, curr) => {
						series = linkSeries(this, prev, curr);

						return curr;
					},
					null
				);

				const accessor = accessors.pop();

				if (!accessor.field){
					throw create('model references need a field: '+path, {
						code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_INVALID'
					});
				} else if (property.isArray){
					throw create('dynamic subschemas not yet supported: '+path, {
						code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_MAGIC'
					});
				}

				// this needs to be get variables, and get variables guarentees where to find
				// the variable
				const field = await this.addField(path, {
					model: accessor.model,
					extends: accessor.field,
					series
				});

				const tables = context.tables;
				if (!tables[series]){
					const refs = context.refs;

					// create two indexes, one to reduce duplicates, one to use later
					const table = {
						name: field.structure.name,
						series: series,
						schema: field.structure.schema,
						fields: [],
						query: null
					};

					tables[series] = table;

					if (!refs[table.name]){
						refs[table.name] = [];
					}

					refs[table.name].push(table);
				}
			} else if (property.type === 'include'){
				// I'm going to make sure all previous files are imported
				const include = accessors.pop();

				if (include.field){
					throw create('can not pull fields from composites: '+path, {
						code: 'BMOOR_CRUD_COMPOSITE_SCHEMA_ACCESS'
					});
				}

				// I don't like this, it limits me to a single, but I'll fix it down
				// the road.
				return {
					name: include.model,
					property,
					connections: [accessors],
					composite: await this.nexus.loadComposite(include.model)
					// query: {}
				};
			} else {
				throw create('unknown line type: '+property.type, {
					code: 'BMOOR_CRUD_COMPOSITE_UNKNOWN'
				});
			}
		});
		
		this.references = (await Promise.all(results))
			.filter(info => info);
	}

	async setConnection(baseModel, targetModel, local=null, settings={}){
		let baseSeries = null;
		let targetSeries = null;

		let relationship = this.nexus.mapper.getRelationship(
			baseModel, targetModel, local
		);

		if (!relationship){
			throw new Error(
				`unable to connect ${baseModel} to ${targetModel}`+
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
		connection.optional = settings.optional || false;

		hub.push(connection);
	}

	// produces representation for interface layer
	async getQuery(queries={}, settings={}, ctx={}){
		await this.link();

		const context = this.context;

		// create a temp object, add any tables needed for queries
		await Object.keys(queries)
		.reduce(
			async (prom, path) => {
				// TODO: clean this up once accessors have series defined
				await prom;
				
				const value = queries[path];
				const access = (new Path(path)).access;

				const mountAccessor = access[access.length-1];
				const mountSeries = mountAccessor.series || mountAccessor.model;

				const mount = context.tables[mountSeries];
				if (!mount){
					throw new Error(`unable to mount: ${mountSeries} from ${path}`);
				}

				await access.reduce(
					async (prev, subAccessor) => {
						prev = await prev;
						
						await addStuff(this, prev, subAccessor);
						
						return subAccessor;
					}, 
					Promise.resolve(null)
				);
				
				const rootAccessor = access[0];
				const rootSeries = rootAccessor.series || rootAccessor.model;
				const root = context.tables[rootSeries];

				if (!root){
					throw new Error('unable to connect: '+path);
				}

				if (!root.query){
					root.query = {};
				}

				// So, if you write a query... you shoud use .notation for incoming property
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
				const series = field.settings.series || field.structure.name;
				
				agg.tables[series].fields.push({
					path: field.storagePath,
					// alias - cleanup
					as: field.reference || null
				});

				return agg;
			},
			// I want a base object with all the tables, so a table isn't dropped if a field isn't allowed
			context
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
						let optional = false;
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

									if (!optional && connection.optional){
										optional = true;
									}
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
										remote: connection.local,
										optional: connection.optional
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

							if (optional){
								table.join.optional = true;
							}
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

	// TODO: I might want to get rid of these if I am going to have the possibility of 
	//   multiple variables pointing to the same thing.
	async getInflater(ctx){
		await this.link();
		
		this.build();

		const inflater = this.actions.inflate;

		return function complexInflate(datum){
			return inflater(datum, ctx);
		};
	}

	async getDeflater(ctx){
		await this.link();

		this.build();

		const deflater = this.actions.deflate;
		
		return function complexDeflate(datum){
			return deflater(datum, ctx);
		};
	}
}

module.exports = {
	Composite
};
