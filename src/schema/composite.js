
const {implode} = require('bmoor/src/object.js');
const {create} = require('bmoor/src/lib/error.js');
const {makeSetter} = require('bmoor/src/core.js');

const {Structure, buildParam, addAccessorsToQuery} = require('./structure.js');
const {Network} = require('../graph/network.js');

const {Path, pathToAccessors} = require('../graph/path.js');
const {Query, QueryJoin, QueryField} = require('./query.js');

async function getOutgoingRelationship(nexus, baseModel, targetModel, local=null){
	await Promise.all([
		nexus.loadModel(baseModel),
		nexus.loadModel(targetModel)
	]);
	
	let relationship = nexus.mapper.getRelationship(
		baseModel, targetModel, local
	);

	if (!relationship){
		const additional = (local ? ' via '+local : '');
		throw create(`unable to connect ${baseModel} to ${targetModel}${additional}`, {
			code: 'BMOOR_CRUD_COMPOSITE_RELATIONSHIP',
			context: {}
		});
	}

	// I only want outgoing relationships
	if (relationship.metadata.direction === 'outgoing'){
		return relationship;
	} else {
		return nexus.mapper.getRelationship(
			targetModel, baseModel, relationship.remote
		);
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
}

async function buildJoins(composite, reference, i){
	// allow sets of accessors to be added.  This would mean multiple properties are
	// used to join into a sub-composite
	return Promise.all(reference.connections.map(
		async(access) => {
			let root = null;
			let prev = null;

			access = access.slice(0);

			// remove all accessors that are part the base schema, the
			// last one becomes the root

			access.reduce(
				(prev, cur) => {
					if (cur.target){
						// the current pointer knows the target property, it gets priority
						const relationship = composite.nexus.mapper.getRelationship(
							cur.model, prev.model, cur.target
						);

						cur.target = relationship.local; // should match cur.target
						prev.field = relationship.remote;
						cur.relationship = relationship;
					} else {
						const relationship = composite.nexus.mapper.getRelationship(
							prev.model, cur.model, prev.field
						);

						cur.target = relationship.remote;
						prev.field = relationship.local;
						cur.relationship = relationship;
					}

					return cur;
				}
			);

			// TODO: this seems like an anti pattern, do I need to change where this
			//   is being computed?
			while(access.length && (
				composite.hasStructure(access[0].model) || 
				composite.incomingSettings.base === access[0].model
			)){
				prev = root;
				root = access.shift();
			}

			// tail is the trailing accessor, root is the known one
			const tail = access.length ? access[access.length-1] : root;
			
			let key = null;
			let clear = null;
			let relationship = null;

			if (tail.model === reference.composite.incomingSettings.base){
				const model = await composite.nexus.loadModel(tail.model);

				key = model.settings.key;

				tail.field = key;
			} else {
				relationship = composite.nexus.mapper.getRelationship(
					tail.model, reference.composite.incomingSettings.base
				);

				if (relationship){
					key = relationship.remote;
					tail.field = relationship.local;
				} else {
					const base = reference.composite.incomingSettings.base;
					const model = tail.model;
					const statement = reference.property.statement;
					
					throw create(`composite ${this.name}: can not connect ${model} to ${base}`, {
						code: 'BMOOR_CRUD_COMPOSITE_NO_PROPERTIES',
						context: {
							statement
						}
					});
				}
			}

			let field = (await composite.nexus.loadModel(root.model)).getField(root.field);
			
			if (!composite.hasField(field)){
				const ref = `sub_${i}`;
				
				field = await composite.addField(ref, {
					model: root.model, 
					extends: root.field,
					series: root.series
				});

				clear = ref;
			}
			
			access.push({
				loader: 'access',
				model: reference.composite.incomingSettings.base,
				series: reference.composite.name,
				target: key,
				relationship
			});

			return {
				root,
				clear,
				path: (new Path(access)).path,
				accessor: access,
				datumPath: field.path
			};
		}
	));
}

function buildCalculations(schema, base){
	const dynamics = implode(schema);

	return Object.keys(dynamics).reduce(
		(old, path) => {
			const fn = dynamics[path];
			const setter = makeSetter(path);

			return function(datum, variables){
				setter(datum, fn(old(datum, variables), variables));

				return datum;
			};
		},
		base
	);
}

class Composite extends Structure {
	constructor(name, nexus){
		super(name, nexus);

		this.calculateDynamics = (datum) => datum;
		this.encodeResults = (datum) => datum;
	}

	// connects all the models and all the fields
	async link(){
		if (this.references){
			return;
		}

		if (this.context){
			return this.context.isLinking;
		}

		const context = {
			refs: {},
			names: {},
			tables: {}
		};
		this.context = context;

		this.base = await this.nexus.getCrud(
			this.incomingSettings.base
		);

		// doing this is protect from collisions if multiple links are called
		// in parallel of the same type
		context.isLinking = new Promise(async (resolve, reject) => {
			try {
				const settings = this.incomingSettings;
			
				let ext = settings.extends;
				if (ext){
					const parent = await this.nexus.loadComposite(ext);

					await parent.link();
					
					this.properties.extend(parent.properties);

					if (!settings.getChangeType){
						settings.getChangeType = parent.incomingSettings.getChangeType;
					}

					if (!settings.onChange){
						settings.onChange = parent.incomingSettings.onChange;
					}

					this.calculateDynamics = parent.calculateDynamics;

					this.encodeResults = parent.encodeResults;
				}

				this.properties.calculateRoots();

				if (this.properties.content.length === 0){
					reject(create(`composite ${this.name}: no properties found`, {
						code: 'BMOOR_CRUD_COMPOSITE_NO_PROPERTIES',
						context: settings
					}));
				}

				// let's go through all the properties and figure out what is a field and 
				// a foreign reference
				context.results = this.properties.content
				.map(async (property) => {
					const path = property.mountPoint;
					const accessors = property.accessors.slice(0);

					if (property.type === 'access'){
						await accessors.reduce(
							async (prom, curr) => {
								const prev = await prom;
								// TODO: just send the accessors
								await this.setConnection(prev.model, curr.model, prev.field, {
									baseSeries: prev.series,
									targetSeries: curr.series,
									optional: curr.optional
								});
								
								return curr;
							}
						);

						const accessor = accessors.pop();
						const series = accessor.series;

						if (!accessor.field){
							reject(
								create(`composite ${this.name}: need a field ${path}`, {
									code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_INVALID',
									context: {
										accessor
									}
								})
							);
						} else if (property.isArray){
							reject(
								create(`composite ${this.name}: dynamic array defined ${path}`, {
									code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_MAGIC',
									context: {
										accessor,
										property
									}
								})
							);
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
							reject(
								create(`composite ${this.name}: no field from ${path}`, {
									code: 'BMOOR_CRUD_COMPOSITE_SCHEMA_ACCESS',
									context: {
										property
									}
								})
							);
						}

						// TODO: I don't like this, it limits me to a single join, 
						// but I'll fix it down the road.
						return {
							name: include.model,
							property,
							connections: [accessors],
							composite: await this.nexus.loadComposite(include.model)
						};
					} else {
						reject(
							create(`composite ${this.name}: unknown type ${property.type}`, {
								code: 'BMOOR_CRUD_COMPOSITE_UNKNOWN',
								context: {
									property
								}
							})
						);
					}
				});
				
				const res = await Promise.all(context.results);
				this.references = res.filter(info => info);

				resolve();
			} catch(ex){
				reject(ex);
			}
		});
		
		return context.isLinking;
	}

	async build(){
		await this.link();

		// this needs to happen before build because it might add a field
		// if needed for a join.
		//----
		// here's what I need to do.  Go through the mount path, figure out
		// the last model / field in the path, and mark that.  The rest goes
		// back into the query
		const subs = await Promise.all(this.references.map(
			async (reference, i) => ({
				reference,
				joins: await buildJoins(this, reference, i)
			})
		));

		await super.build();

		// add subs to the settings object defined in parent build
		Object.assign(this.settings, {subs});
	}
	/***
	 * {
	 *  nexus,
	 *  fields,
	 *  extends
	 * }
	 ***/
	async configure(settings){
		await super.configure(settings);
		
		this.context = null;
		this.connections = {};
		this.properties = new CompositeProperties(
			settings.fields,
			settings.base
		);

		const rtn = await this.build();

		this.calculateDynamics = buildCalculations(
			settings.dynamics,
			this.calculateDynamics
		);

		if (settings.encode){
			const encode = settings.encode;

			if (this.encodeResults){
				const old = this.encodeResults;

				this.encodeResults = async function(schema, ctx){
					return encode(await old(schema, ctx), ctx); 
				};
			} else {
				this.encodeResults = encode;
			}
		}

		return rtn;  
	}

	hasStructure(structureName){
		let found = null;

		for (let i = 0, c = this.fields.length; i < c && !found; i++){
			const field = this.fields[i];

			if (field.structure.name === structureName){
				found = field;
			}
		}

		return found;
	}

	assignField(field, settings){
		// I don't think I need this anymore?
		// this.references[field.reference] = field;

		return super.assignField(field, settings);
	}

	defineField(path, settings={}){
		if (!settings.extends){
			throw create(`complex ${this.name}: failed on ${path}`, {
				code: 'BMOOR_CRUD_COMPOSITE_SERIES',
				context: settings
			});
		}

		// let's overload the other field's settings
		const fieldSettings = {
			series: settings.series,
			reference: settings.reference
		};

		return settings.extends.extend(path, fieldSettings);
	}

	async addField(path, settings={}){
		if (!settings.series){
			throw create(`Unable to link path without target series`, {
				code: 'BMOOR_CRUD_COMPOSITE_SERIES',
				context: settings
			});
		}

		const modelName = settings.model;
		const reference = settings.extends;

		const model = await this.nexus.loadModel(modelName);
		const field = model.getField(reference);

		if (!field){
			throw create(`Complex, unknown field: ${modelName}.${reference}`, {
				code: 'BMOOR_CRUD_COMPOSITE_UNKNOWN',
				context: {
					path,
					modelName,
					reference
				}
			});
		}

		if (this.connector){
			if (this.connector !== model.connector){
				throw create(`Mixing connector types: ${this.connector} => ${modelName}.${model.connector}`, {
					code: 'BMOOR_CRUD_COMPOSITE_CONNECTOR',
					context: {
						current: this.connector,
						model: modelName,
						newConnector: model.connector
					}
				});
			}
		} else {
			this.connector = model.connector;
		}

		settings.extends = field;

		return super.addField(path, settings);
	}

	async setConnection(baseModel, targetModel, local=null, settings={}){
		let baseSeries = null;
		let targetSeries = null;

		let relationship = await getOutgoingRelationship(
			this.nexus, baseModel, targetModel, local
		);

		// I only want outgoing relationships
		if (relationship.name === targetModel){
			baseSeries = settings.baseSeries || baseModel;
			targetSeries = settings.targetSeries || targetModel;
		} else {
			// so flip it
			baseSeries = settings.targetSeries || targetModel;
			targetSeries = settings.baseSeries || baseModel;
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
	async getQuery(settings={}, ctx={}){
		const query = settings.query || new Query(this.properties.model);

		await this.link();

		const context = this.context;

		Object.keys(context.tables)
		.forEach(
			(series) => {
				const table = context.tables[series];

				query.setSchema(series, table.schema);
			}
		);

		const tables = Object.values(context.tables);
		if (tables.length > 1){
			(new Network(this.nexus.mapper)).anchored(
				tables.map(table => table.name), 1
			).forEach(link => {
				// a table can be referenced by multiple things, so one table, multiple series...
				// think an item having a creator and owner
				context.refs[link.name]
				.forEach(table => {
					// this.connection is a directed graph, which is fine unless
					// we have the pattern 2 <- 1 <- 2 and we end up with two tables
					// not being joined correctly.  The idea is to hoist the primary node
					// to the front and delegate the connections to the other tables
					const connections = this.connections[table.series];
					if (connections){
						query.addJoins(table.series, connections.map(
							(connection) => new QueryJoin(connection.name, [{
								from: connection.local,
								to: connection.remote
							}], connection.optional)
						));
					}
				});
			});
		}

		return super.getQuery(
			{
				query: query,
				joins: settings.joins,
				params: settings.params,
				sort: settings.sort,
				position: settings.position
			},
			ctx
		);
	}

	async getKeyQueryByModel(modelName, key/*, ctx={}*/){
		const baseModel = this.base.structure.name;
		const query = new Query(baseModel);

		const [model] = await Promise.all([
			this.nexus.loadModel(modelName),
			this.link()
		]);

		const context = this.context;

		const tables = Object.values(context.tables);
		if (tables.length > 1){
			(new Network(this.nexus.mapper)).path(
				modelName, baseModel, tables.map(table => table.name), 1
			).forEach(link => {
				// a table can be referenced by multiple things, so one table, multiple series...
				// think an item having a creator and owner
				context.refs[link.name]
				.forEach(table => {
					query.setSchema(table.series, table.schema);

					// a model can have multiple series, if so, let's just link
					// in here
					if (link.name === modelName){
						query.addParams(
							table.series,
							[buildParam(model.settings.key, key)]
						);
					}

					const connections = this.connections[table.series];
					
					if (connections){
						query.addJoins(table.series, connections.map(
							(connection) => new QueryJoin(connection.name, [{
								from: connection.local,
								to: connection.remote
							}], connection.optional)
						));
					}
				});
			});
		}

		query.addFields(baseModel, [
			// TODO
			new QueryField(this.incomingSettings.key, 'key')
		]);

		return query;
	}

	// this.settings.subs.reference.composite
	async getKeyQueryBySub(compositeName, key/*, ctx*/){
		const baseModel = this.base.structure.name;
		const query = new Query(baseModel);

		await this.link();

		const target = this.settings.subs.reduce(
			(agg, sub) => {
				if (agg){
					return agg;
				}

				if (sub.reference.composite.name === compositeName){
					return sub;
				}
			},
			null
		);

		let joinFrom = [];
		if (target){
			const series = baseModel;
			const model = await this.nexus.loadModel(series);

			// TODO: so say you have two users, one links to an owner schema, 
			//  another links to who last updated.  The owner schema being based
			//  on user makes this ambiguous.  I'm not dealing with it now, I consider
			//  it an edge case, but it's definitely a problem.
			joinFrom = await Promise.all(target.joins.map(
				async (join) => {
					await addAccessorsToQuery(join.accessor, query, this.nexus);
				
					query.addParams(
						join.accessor[join.accessor.length-1].series,
						[buildParam(model.settings.key, key)]
					);

					await addAccessorsToQuery([join.root, join.accessor[0]], query, this.nexus);

					return join.root.series;
				}
			));
		} else {
			throw create(`composite: ${this.name} unable to join ${compositeName}`, {
				code: 'BMOOR_CRUD_COMPOSITE_SUB',
				context: {
					key
				}
			});
		}

		const context = this.context;

		const tables = Object.values(context.tables);
		if (tables.length > 1){
			(new Network(this.nexus.mapper)).branch(
				joinFrom, baseModel, tables.map(table => table.name), 1
			).forEach(link => {
				// a table can be referenced by multiple things, so one table, multiple series...
				// think an item having a creator and owner
				context.refs[link.name]
				.forEach(table => {
					query.setSchema(table.series, table.schema);

					const connections = this.connections[table.series];
					
					if (connections){
						query.addJoins(table.series, connections.map(
							(connection) => new QueryJoin(connection.name, [{
								from: connection.local,
								to: connection.remote
							}], connection.optional)
						));
					}
				});
			});
		}

		query.addFields(baseModel, [
			// TODO
			new QueryField(this.incomingSettings.key, 'key')
		]);

		return query;
	}

	async getInflater(ctx){
		await this.link();
		
		const inflater = this.actions.inflate;

		return function complexInflate(datum){
			return inflater(datum, ctx);
		};
	}

	async getDeflater(ctx){
		await this.link();

		const deflater = this.actions.deflate;
		
		return function complexDeflate(datum){
			return deflater(datum, ctx);
		};
	}
}

module.exports = {
	Composite
};
