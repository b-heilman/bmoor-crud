
const {implode} = require('bmoor/src/object.js');
const {create} = require('bmoor/src/lib/error.js');
const {makeSetter} = require('bmoor/src/core.js');

const {Structure, buildParam} = require('./structure.js');

const {pathToAccessors} = require('../graph/path.js');
const {Query, QueryJoin, QueryField} = require('./query.js');

function instructionIndexMerge(target, incoming){
	Object.keys(incoming).forEach(key => {
		const existing = target[key];
		const additional = incoming[key];

		if (existing){
			Object.assign(existing.join, additional.join);

			if (additional.incoming){
				existing.incoming = existing.incoming.concat(
					additional.incoming
				);
			}
		} else {
			target[key] = additional;
		}
	});

	return target;
}

// used to parse appart the paths that can be fed into a composite schema
class CompositeInstructions {
	constructor(baseModel, joinSchema, fieldSchema){
		this.model = baseModel;

		this.index = joinSchema.reduce(
			(agg, path) => {
				path = path.replace(/\s/g,'');

				if (path[0] !== '$'){
					path = '$'+baseModel + path;
				}

				const accessors = pathToAccessors(path);
				let last = accessors.shift();
				while (accessors.length){
					let cur = accessors.shift();
					
					const {series, field} = last;

					const base = agg[series];
					if (!base){
						throw create(`can not connect to ${series}`, {
							code: 'BMOOR_CRUD_COMPOSITE_MISSING_SERIES',
							context: {
								path
							}
						});
					}

					// this is a two way linked list, this if forward
					base.join[cur.series] = {
						from: field,
						to: cur.target
					};

					if (agg[cur.series]){
						agg[cur.series].incoming.push(series);
					} else {
						if (cur.loader === 'include'){
							agg[cur.series] = {
								series: cur.series,
								composite: cur.model,
								structural: true,
								optional: cur.optional,
								incoming: [series]
							};
						} else {
							agg[cur.series] = {
								series: cur.series,
								model: cur.model,
								structural: true,
								optional: cur.optional,
								incoming: [series], // this is backwards
								join: {}
							};
						}
					}

					last = cur;
				}

				return agg;
			},
			{
				[baseModel]: {
					model: baseModel,
					series: baseModel,
					structural: true,
					join: {}
				}
			}
		);

		// break this into
		// [path]: [accessor]
		const imploded = implode(fieldSchema);
		const {fields, subs} = Object.keys(imploded).map(
			(mount) => {
				let statement = imploded[mount];

				statement = statement.replace(/\s/g,'');

				if (statement[0] === '.'){
					statement = '$'+baseModel + statement;
				}

				// if it's an = statement, the properties can't be short hand
				const action = pathToAccessors(statement)[0]; // this is an array of action tokens
				if (!action){
					throw create(`unable to parse ${statement}`, {
						code: 'BMOOR_CRUD_COMPOSITE_PARSE_STATEMENT',
						context: {
							statement
						}
					});
				}

				const isArray = mount.indexOf('[0]') !== -1;

				const path = mount.substring(0, isArray ? mount.length-3 : mount.length);

				// These will all use the series name, and not the model, so I need
				// to update all of the actions to have the correct model, incase they
				// are using a series instead of just the base model name
				const join = this.index[action.series];
				if  (join){
					join.structural = false;
				} else {
					throw create(`requesting field not joined ${action.series}`, {
						code: 'BMOOR_CRUD_COMPOSITE_MISSING_JOIN',
						context: {
							statement
						}
					});
				}

				action.model = join.model;

				return {
					type: action.loader,
					action,
					statement,
					path,
					isArray,
					mountPoint: mount
				};
			}
		).reduce(
			(agg, info) => {
				if (info.type === 'access'){
					agg.fields.push(info);
				} else if (info.type === 'include'){
					agg.subs.push(info);
				} else {
					throw create(`unknown type ${info.type}`, {
						code: 'BMOOR_CRUD_COMPOSITE_UNKNOWN',
						context: {
							info
						}
					});
				}

				return agg;
			},
			{
				fields: [],
				subs: []
			}
		);

		this.subs = subs;
		this.fields = fields;
		this.variables = {};
	}

	extend(parent){
		if (this.model !== parent.model){
			if (!this.index[parent.model]){
				this.index[parent.model] = {
					model: parent.model,
					series: parent.model,
					structural: true,
					optional: false,
					incoming: [this.model],
					join: {}
				};

				this.index[this.model].join[parent.model] = {
					from: null,
					to: null
				};
			}
		}

		this.index = instructionIndexMerge(this.index, parent.index);

		this.subs = this.subs.concat(parent.subs);
		this.fields = this.fields.concat(parent.fields);
	}

	getAllSeries(){
		return Object.keys(this.index);
	}

	getSeries(series){
		return this.index[series];
	}

	getJoin(from, to){
		return this.index[from].join[to];
	}

	getIncoming(to){
		return this.getSeries(to).incoming;
	}

	forEach(fn){
		const processed = {};

		let toProcess = [this.model];

		while(toProcess.length){
			const seriesName = toProcess.shift();
			
			if (processed[seriesName]){
				return;
			} else {
				processed[seriesName] = true;
			}
			
			const seriesInfo = this.getSeries(seriesName);

			fn(seriesName, seriesInfo);

			if (seriesInfo.join){
				toProcess = toProcess.concat(Object.keys(
					seriesInfo.join
				));
			}
		}
	}

	getSeriesByModel(model){
		return Object.keys(this.index)
		.filter(series => this.index[series].model === model);
	}

	// returns back all the models going back to the root
	getTrace(...to){
		const trace = [];
		let toProcess = to;

		while(toProcess.length){
			const curSeries = toProcess.shift();
			const cur = this.getSeries(curSeries);

			trace.push(cur);

			if (cur.incoming){
				toProcess = toProcess.concat(cur.incoming);
			}
		}

		const found = {};
		return trace.reverse()
		.filter(cur => {
			if (found[cur.series]){
				return false;
			} else {
				found[cur.series] = true;
				return true;
			}
		});
	}

	getMount(doc){
		const begin = this.getSeries(doc);

		const trace = [begin];
		let toProcess = begin.incoming.slice(0);

		while(toProcess.length){
			const curSeries = toProcess.shift();
			const cur = this.getSeries(curSeries);

			trace.push(cur);

			if (cur.incoming && cur.structural){
				toProcess = toProcess.concat(cur.incoming);
			}
		}

		const found = {};
		return trace.reverse()
		.filter(cur => {
			if (found[cur.series]){
				return false;
			} else {
				found[cur.series] = true;
				return true;
			}
		});
	}

	// TODO: I should do something that calculates the relationships for join
	getOutgoingLinks(series){
		const rtn = [];
		const seriesInfo = this.getSeries(series);

		if (seriesInfo.incoming){
			seriesInfo.incoming.forEach(incomingSeries => {
				const join = this.getJoin(
					incomingSeries, series
				);

				const direction = join.relationship.metadata.direction;
				const vector = join.relationship.name;
				if ((vector === series && direction === 'incoming') ||
					(vector !== series && direction === 'outgoing')
				){
					rtn.push({
						local: join.to,
						remote: join.from,
						series: incomingSeries
					});
				}
			});
		}

		Object.keys(seriesInfo.join).forEach(outgoingSeries => {
			const join = seriesInfo.join[outgoingSeries];

			const direction = join.relationship.metadata.direction;
			const vector = join.relationship.name;
			if ((vector === series && direction === 'incoming') ||
				(vector !== series && direction === 'outgoing')
			){
				rtn.push({
					local: join.from,
					remote: join.to,
					series: outgoingSeries
				});
			}
		});

		return rtn;
	}
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

async function computeJoin(composite, join, fromModel, toModel){
	await Promise.all([
		composite.nexus.loadModel(fromModel),
		composite.nexus.loadModel(toModel)
	]);

	if (join.to){
		// the current pointer knows the target property, it gets priority
		const relationship = composite.nexus.mapper.getRelationship(
			toModel, fromModel, join.to
		);

		if (!relationship){
			throw create(`composite ${composite.name}: can not connect ${fromModel} to ${toModel}`, {
				code: 'BMOOR_CRUD_COMPOSITE_NO_TO',
				context: {
					fromModel, 
					toModel,
					join
				}
			});
		}

		const actualRelationship = composite.nexus.mapper.getRelationship(
			fromModel, toModel, relationship.remote, relationship.local
		);

		
		join.to = actualRelationship.remote; // should match cur.target
		join.from = actualRelationship.local;
		join.relationship = actualRelationship;
	} else if (join.from){
		const relationship = composite.nexus.mapper.getRelationship(
			fromModel, toModel, join.from
		);

		if (!relationship){
			throw create(`composite ${composite.name}: can not connect ${fromModel} to ${toModel}`, {
				code: 'BMOOR_CRUD_COMPOSITE_NO_FROM',
				context: {
					fromModel, 
					toModel,
					join
				}
			});
		}

		join.to = relationship.remote; // should match cur.target
		join.from = relationship.local;
		join.relationship = relationship;
	} else {
		const relationship = composite.nexus.mapper.getRelationship(
			fromModel, toModel
		);

		if (!relationship){
			throw create(`composite ${composite.name}: can not connect ${fromModel} to ${toModel}`, {
				code: 'BMOOR_CRUD_COMPOSITE_NO_RELATIONSHIP',
				context: {
					fromModel, 
					toModel,
					join
				}
			});
		}

		join.to = relationship.remote; // should match cur.target
		join.from = relationship.local;
		join.relationship = relationship;
	}
}

class Composite extends Structure {
	constructor(name, nexus){
		super(name, nexus);

		this.calculateDynamics = (datum) => datum;
		this.encodeResults = (datum) => datum;
	}

	async linkFields(){
		return Promise.all(this.instructions.fields.map(
			async (property) => {
				const accessor = property.action;
				const series = accessor.series;

				if (!accessor.field){
					throw create(`composite ${this.name}: need a field ${property.statement}`, {
						code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_INVALID',
						context: {
							accessor
						}
					});
				} else if (property.isArray){
					throw create(`composite ${this.name}: dynamic array defined ${property.statement}`, {
						code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_MAGIC',
						context: {
							accessor,
							property
						}
					});
				}

				// this needs to be get variables, and get variables guarentees where to find
				// the variable
				await this.addField(property.path, {
					model: accessor.model,
					extends: accessor.field,
					series
				});
			}
		));

	}

	async linkSubs(){
		return Promise.all(this.instructions.subs.map(
			async (sub, i) => {
				// I'm going to make sure all previous files are imported
				const include = sub.action;

				if (include.field){
					throw create(`composite ${this.name}: no field from ${sub.statement}`, {
						code: 'BMOOR_CRUD_COMPOSITE_SCHEMA_ACCESS',
						context: {
							sub
						}
					});
				}

				const info = this.instructions.getSeries(include.series);
				const composite = await this.nexus.loadComposite(info.composite);
				// I'm making this only work with one link right now, but 
				// multiple could work
				const incomingSeries = info.incoming[0];
				const tail = this.instructions.getSeries(incomingSeries);
				const join = tail.join[include.series];

				if (tail.model === composite.baseModel.name){
					const model = await composite.nexus.loadModel(tail.model);

					const key = model.getKeyField();

					join.to = key;
					join.from = key;
				} else {
					await computeJoin(
						this, join, tail.model, composite.baseModel.name
					);
				}

				let field = (await composite.nexus.loadModel(tail.model)).getField(join.from);
				if (!this.hasField(field)){
					const ref = `sub_${i}`;
					
					field = await this.addField(ref, {
						model: tail.model, 
						series: incomingSeries,
						extends: join.from,
						synthetic: true
					});

					join.clear = ref;
				}

				return {
					info: sub,
					path: field.path,
					joins: [
						join
					],
					connection: tail,
					composite: await this.nexus.loadComposite(include.series)
				};
			}
		));
	}
	
	// connects all the models and all the fields
	async link(){
		if (this.references){
			return;
		}

		if (this._isLinking){
			return this._isLinking;
		}

		this.base = await this.nexus.getCrud(
			this.incomingSettings.base
		);
		this.baseModel = this.base.structure;

		// doing this is protect from collisions if multiple links are called
		// in parallel of the same type
		this._isLinking = new Promise(async (resolve, reject) => {
			try {
				const settings = this.incomingSettings;
			
				let ext = settings.extends;
				if (ext){
					const parent = await this.nexus.loadComposite(ext);

					await parent.link();
					
					this.instructions.extend(parent.instructions);

					if (!settings.getChangeType){
						settings.getChangeType = parent.incomingSettings.getChangeType;
					}

					if (!settings.onChange){
						settings.onChange = parent.incomingSettings.onChange;
					}

					this.calculateDynamics = parent.calculateDynamics;

					this.encodeResults = parent.encodeResults;
				}

				if (this.instructions.fields.length === 0){
					reject(create(`composite ${this.name}: no properties found`, {
						code: 'BMOOR_CRUD_COMPOSITE_NO_PROPERTIES',
						context: settings
					}));
				}

				// let's go through all the properties and figure out what is a field and 
				// a foreign reference
				await Promise.all(this.instructions.getAllSeries().map(
					async (series) => {
						const info = this.instructions.getSeries(series);

						if (!info.join){
							// subs don't join, so skip them
							return;
						}

						return Promise.all(Object.keys(info.join).map(
							async (nextSeries) => {
								const join = info.join[nextSeries];
								const nextInfo = this.instructions.getSeries(nextSeries);

								if (nextInfo.model){
									await computeJoin(
										this, join, info.model, nextInfo.model
									);
								} else {
									// if it's a sub, it just needs to join to the closest
									// model, so don't bother here
								}
							}
						));
					}
				));

				await this.linkFields();

				this.subs = await this.linkSubs();

				resolve();
			} catch(ex){
				reject(ex);
			}
		});
		
		return this._isLinking;
	}

	async build(){
		await this.link();

		await super.build();
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
		
		if (!settings.base){
			throw create(`composite ${this.name}: no base defined`, {
				code: 'BMOOR_CRUD_COMPOSITE_CONFIGURE_BASE',
				context: settings
			});
		}

		if (!settings.joins){
			throw create(`composite ${this.name}: no joins defined`, {
				code: 'BMOOR_CRUD_COMPOSITE_CONFIGURE_JOINS',
				context: settings
			});
		}

		if (!settings.fields){
			throw create(`composite ${this.name}: no fields defined`, {
				code: 'BMOOR_CRUD_COMPOSITE_CONFIGURE_FIELDS',
				context: settings
			});
		}

		this.instructions = new CompositeInstructions(
			settings.base,
			settings.joins,
			settings.fields
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
			throw create(`composite ${this.name}: failed on ${path}`, {
				code: 'BMOOR_CRUD_COMPOSITE_SERIES',
				context: settings
			});
		}

		// let's overload the other field's settings
		const fieldSettings = {
			series: settings.series,
			reference: settings.reference,
			synthetic: settings.synthetic
		};

		// this is basically: new Field(path, this, settings);
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

	// produces representation for interface layer
	async getQuery(settings={}, ctx={}){
		const query = settings.query || new Query(this.instructions.model);

		await this.link();

		this.instructions.forEach((series, seriesInfo) => {
			if (seriesInfo.composite){
				return;
			}

			query.setSchema(series, this.nexus.getModel(seriesInfo.model).schema);

			const joinsTo = seriesInfo.join;
			
			if (joinsTo){
				const todo = Object.keys(joinsTo);
				if (todo.length){
					query.addJoins(series, todo.filter(
							nextSeries => !this.instructions.getSeries(nextSeries).composite
						).map(
							(nextSeries) => {
								const join = joinsTo[nextSeries];

								const subSeries = this.instructions.getSeries(nextSeries);

								return new QueryJoin(
									nextSeries, 
									[{from: join.from, to: join.to}], 
									subSeries.optional
								);
							}
						)
					);
				}
			}
		});

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

	// this.settings.subs.reference.composite
	async getKeyQueryBySeries(compositeName, key/*, ctx*/){
		await this.link();

		const baseModel = this.baseModel.name;
		const query = new Query(baseModel);

		// get everything from the composite to the outer layer
		const linking = this.instructions.getTrace(compositeName)
		.map(async ({series, incoming, optional}) => {
			const modelName = this.instructions.getSeries(series).model;

			if (modelName){
				const model = await this.nexus.loadModel(modelName);

				query.setSchema(series, model.schema);
			} else {
				// I can do this because there should be only on sub in
				// the chain

				// add the composite's model and request the key
				const sub = await this.nexus.loadComposite(compositeName);
				const model = await this.nexus.loadModel(sub.baseModel.name);

				query.setSchema(compositeName, model.schema);

				query.addParams(
					compositeName,
					[buildParam(model.getKeyField(), key)]
				);
			}

			if (incoming){
				// Do I care where I am connecting to?
				query.addJoins(series, incoming.map(
					(joiner) => {
						const join = this.instructions.getJoin(
							joiner, series
						);
						
						return new QueryJoin(
							joiner, 
							[{from: join.to, to: join.from}],
							optional
						);
					}
				));
			}
		});

		await Promise.all(linking);

		// return back the keys of the base model
		query.addFields(baseModel, [
			new QueryField(this.baseModel.getKeyField(), 'key')
		]);

		return query;
	}

	async getKeyQueryByModel(byModelName, key/*, ctx={}*/){
		await this.link();

		const baseModel = this.baseModel.name;
		const query = new Query(baseModel);

		// get everything from the composite to the outer layer
		const linking = this.instructions.getTrace(
			...this.instructions.getSeriesByModel(byModelName)
		).map(async ({series, incoming, optional}) => {
			const modelName = this.instructions.getSeries(series).model;
			const model = await this.nexus.loadModel(modelName);

			query.setSchema(series, model.schema);

			if (byModelName === modelName){
				query.addParams(
					series,
					[buildParam(model.getKeyField(), key)]
				);
			}

			if (incoming){
				// Do I care where I am connecting to?
				query.addJoins(series, incoming.map(
					(joiner) => {
						const join = this.instructions.getJoin(
							joiner, series
						);
						
						return new QueryJoin(
							joiner, 
							[{from: join.to, to: join.from}],
							optional
						);
					}
				));
			}
		});

		await Promise.all(linking);

		// return back the keys of the base model
		query.addFields(baseModel, [
			new QueryField(this.baseModel.getKeyField(), 'key')
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
	CompositeInstructions,
	Composite
};
