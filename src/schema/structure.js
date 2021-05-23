
const {Config} = require('bmoor/src/lib/config.js');
const {makeGetter, makeSetter} = require('bmoor/src/core.js');
const {apply} = require('bmoor/src/lib/error.js');
const {create} = require('bmoor/src/lib/error.js');

const {Field} = require('./field.js');
const {Path} = require('../graph/path.js');
const {Query, QueryField, QueryParam, QueryJoin, QuerySort, QueryPosition} = require('./query.js');

const types = new Config({
	json: {
		onInflate: function(tgt, src, setter, getter){
			const value = getter(src);

			if (value){
				setter(tgt, JSON.parse(value));
			}
		},
		onDeflate: function(tgt, src, setter, getter){
			const value = getter(src);

			if (value){
				setter(tgt, JSON.stringify(value));
			}
		}
	},
	monitor: {
		onCreate: function(tgt, src, setter, getter, cfg){
			const target = cfg.getTarget(src);

			if (target !== undefined){
				setter(tgt, Date.now());
			}
		},
		onUpdate: function(tgt, src, setter, getter, cfg){
			const target = cfg.getTarget(src);

			if (target !== undefined){
				setter(tgt, Date.now());
			}
		}
	}
});

/**
tableLink: {
	name:
	field:	
}

fieldDef: {
	-- crud operations
	create
	read
	update

	-- 
	key: // is a primary key
	index: // can be used as a unique index
	query: // fields allowed to be queries on

	-- structure
	link: <tableLink> // if a foreign key
	internal: ''  TODO : internal structure
}

fields: {
	[externalPath]: <fieldDef>
}

structure: {
	name: '',
	type: '',
	fields: <fields>
}
**/

function actionExtend(op, incoming, outgoing, old, cfg){
	const getter = makeGetter(incoming);
	const setter = makeSetter(outgoing);

	if (old){
		return function(tgt, src, ctx){
			op(old(tgt, src, ctx), src, setter, getter, cfg, ctx);

			return tgt;
		};
	} else {
		return function(tgt, src, ctx){
			op(tgt, src, setter, getter, cfg, ctx);

			return tgt;
		};
	}
}

function buildActions(actions, field){
	const path = field.path;
	const reference = field.reference;
	const storagePath = field.storagePath;
	
	const settings = field.incomingSettings;

	let cfg = {};

	if (settings.cfg){
		cfg = settings.cfg;
		if (cfg.target){
			cfg.getTarget = makeGetter(cfg.target);
		}
	}

	if (settings.onCreate){
		actions.create = actionExtend(settings.onCreate, path, path, actions.create, cfg);
	}

	if (settings.onUpdate){
		actions.update = actionExtend(settings.onUpdate, path, path, actions.update, cfg);
	}

	// inflate are changes out of the database
	if (settings.onInflate){
		actions.inflate = actionExtend(settings.onInflate, reference, path, actions.inflate, cfg);
	}

	// deflate are changes into the database
	if (settings.onDeflate){
		actions.deflate = actionExtend(settings.onDeflate, path, storagePath, actions.deflate, cfg);
	}

	if (path !== reference){
		// data changes from internal to external
		actions.mutatesInflate = true;
	}

	if (path !== storagePath){
		// data changes from external to internal
		actions.mutatesDeflate = true;
	}

	return actions;
}

function buildInflate(baseInflate, fields, structureSettings={}){
	const mutator = fields.reduce(
		(old, field) => {
			if (field.incomingSettings.onInflate){
				// this means the mapping is handled by the function and is already
				// being passed in
				return old;
			} else {
				// TODO: isFlat needs to come from the adapter? but how...
				const getter = structureSettings.isFlat ?
					(datum) => datum[field.reference] :
					makeGetter(field.reference);
				const setter = makeSetter(field.path);

				if (old){
					return function(src){
						const tgt = old(src);

						const val = getter(src);
						if (val !== undefined){
							setter(tgt, val);
						}

						return tgt;
					};
				} else {
					return function(src){
						const tgt = {};

						const val = getter(src);
						if (val !== undefined){
							setter(tgt, val);
						}

						return tgt;
					};
				}
			}
		},
		null
	);

	if (baseInflate && mutator){
		return function mutateInflaterFn(datum, ctx){
			return baseInflate(mutator(datum), datum, ctx);
		};
	} else if (!mutator){
		return function inflaterFn(datum, ctx){
			return baseInflate({}, datum, ctx);
		};
	} else {
		return function mutatorFn(datum/*, ctx*/){
			return mutator(datum);
		};
	}
}

function buildDeflate(baseDeflate, fields, structureSettings={}){
	const mutator = fields.reduce(
		(old, field) => {
			if (field.incomingSettings.onDeflate){
				return old;
			} else {
				const getter = makeGetter(field.path);
				const setter = structureSettings.isFlat ?
					function(datum, value) {datum[field.storagePath] = value;} :
					makeSetter(field.storagePath) ;

				if (old){
					return function(src){
						const tgt = old(src);

						const val = getter(src);
						if (val !== undefined){
							setter(tgt, val);
						}

						return tgt;
					};
				} else {
					return function(src){
						const tgt = {};

						const val = getter(src);
						if (val !== undefined){
							setter(tgt, val);
						}

						return tgt;
					};
				}
			}
		},
		null
	);

	if (baseDeflate && mutator){
		return function mutateDeflaterFn(datum, ctx){
			return baseDeflate(mutator(datum), datum, ctx);
		};
	} else if (!mutator){
		return function deflaterFn(datum, ctx){
			return baseDeflate({}, datum, ctx);
		};
	} else {
		return function mutatorFn(datum/*, ctx*/){
			return mutator(datum);
		};
	}
}

function buildParam(field, v){
	if (typeof(v) === 'object'){
		if (Array.isArray(v)){
			return new QueryParam(field, v, '=');
		} else {
			return Object.keys(v).map(
				op => new QueryParam(field, v[op], op)
			);
		}
	} else {
		return new QueryParam(field, v, '=');
	}
}

class Structure {
	constructor(name, nexus){
		this.name = name;
		this.nexus = nexus;
	}

	configure(settings){
		this.incomingSettings = settings;
		
		this.fields = [];
		this.index = {};
		this.actions = null;
	}

	async build(){
		if (!this.actions){
			this.actions = this.fields.reduce(buildActions, {
				mutates: false
			});

			this.actions.inflate = buildInflate(
				this.actions.inflate,
				this.fields,
				this.incomingSettings
			);

			this.actions.deflate = buildDeflate(
				this.actions.deflate,
				this.fields,
				this.incomingSettings
			);
		}
	}

	assignField(field){
		this.actions = null; // if we add a field, clear existing actions

		const found = this.index[field.path];
		if (found){
			throw create(`Path collision`, {
				code: 'BMOOR_CRUD_STRUCTURE_COLLISION',
				context: {
					name: this.name,
					existing: this.index[field.path],
					incoming: field
				}
			});
		}

		this.index[field.path] = field;
		this.fields.push(field);

		return field;
	}

	defineField(path, settings){
		if (settings.type){
			// this allows types to define onCreate, onRead, onUpdate, onDelete
			Object.assign(settings, types.get(settings.type)||{});
		}

		return new Field(path, this, settings);
	}

	createField(path, settings){
		return this.assignField(this.defineField(path, settings), settings);
	}

	async addField(path, settings){
		return this.createField(path, settings);
	}

	getField(path){
		return this.index[path];
	}

	getFields(){
		return this.fields;
	}

	// TODO: I don't like this... structure is the model
	// this feels wrong being here... seems like it's only needed by composite?
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

	hasField(searchField){
		let found = false;

		for (let i = 0, c = this.fields.length; i < c && !found; i++){
			const field = this.fields[i];

			found = (field === searchField || field.original === searchField);
		}

		return found;
	}

	async testFields(type, ctx){
		return this.fields.reduce(
			async (prom, field) => {
				const agg = await prom;
				const op = field.incomingSettings[type]; // I don't personally like this...
				                                 // the model should handle this logic

				if (op){
					if (typeof(op) === 'string'){
						try {
							if (ctx.hasPermission(op)){
								agg.push(field);
							}
						} catch(ex){
							apply(ex, {
								code: 'BMOOR_CRUD_SCHEMA_TEST_FIELD',
								context: {
									type,
									external: field.path,
									structure: field.structure.name
								}
							});

							throw ex;
						}
					} else {
						agg.push(field);
					}
				}

				return agg;
			},
			[]
		);
	}

	deflate(datum, ctx){
		if (!this.actions){
			this.build();
		}

		return this.actions.deflate(datum, ctx);
	}

	inflate(datum, ctx){
		if (!this.actions){
			this.build();
		}

		return this.actions.inflate(datum, ctx);
	}

	async getQuery(settings, ctx){
		const query = settings.query || new Query(this.name);

		(await this.testFields('read', ctx))
		.forEach(
			(field) => {
				query.addFields(field.series, [
					new QueryField(field.storagePath, field.reference || null)
				]);
			}
		);

		if (settings.params){
			query.addParams(
				query.base,
				Object.keys(settings.params).map(
					field => buildParam(field, settings.params[field])
				)
			);
		}

		if (settings.joins){
			await Object.keys(settings.joins || {})
			.reduce(
				async (prom, path) => {
					await prom;
					
					const comparison = settings.joins[path];
					const access = (new Path(path)).access;

					// links in are [model].value > [existingModel]
					// TODO: I think I want to flip that?
					const mountAccessor = access[access.length-1];
					const mountSeries = mountAccessor.series;

					// this verified the mount point is inside the model
					if (!query.hasSeries(mountSeries)){
						throw new Error(`unable to mount: ${mountSeries} from ${path}`);
					}

					await access.reduce(
						async (prev, accessor) => {
							let relationship = null;
							let from = null;
							let to = null;
							let pSeries = prev.series;
							let aSeries = accessor.series;

							prev = await prev;

							query.setSchema(aSeries, accessor.model);
							
							// this ensures everything is linked accordingly
							// await addStuff(this, prev, subAccessor);
							if (accessor.target) {
								relationship = this.nexus.mapper.getRelationship(
									accessor.model, prev.model, accessor.target
								);
								from = aSeries;
								to = pSeries;
							} else {
								relationship = this.nexus.mapper.getRelationship(
									prev.model, accessor.model, prev.field
								);
								from = pSeries;
								to = aSeries;
							}

							query.addJoins(from, [
								new QueryJoin(to, [{
									from: relationship.local,
									to: relationship.remote
								}], accessor.optional)
							]);
							
							return accessor;
						}
					);
					
					const rootAccessor = access[0];
					
					query.setSchema(rootAccessor.series, rootAccessor.model);

					// So, if you write a query... you shoud use .notation for incoming property
					// if incase they don't, I allow a failback to field.  It isn't ideal, but it's
					// flexible.  Use the target incase I decide to change my mind in the future
					query.addParams(rootAccessor.series, [
						buildParam(rootAccessor.target||rootAccessor.field, comparison)
					]);
				}, 
				Promise.resolve(true)
			);
		}

		if (settings.sort){
			const sorts = settings.sort.split(',')
				.map(option => {
					let ascending = true;
					let char = option[0];

					if (char === '-'){
						ascending = false;
						option = option.substr(1);
					} else if (char === '+'){
						option = option.substr(1);
					}

					let base = query.base;
					if (option[0] === '$'){
						const pos = option.indexOf('.');

						base = option.substr(1, pos);
						option = option.substr(pos+1);
					}

					return new QuerySort(base, option, ascending);
				});

			query.setSort(sorts);
		}

		if (settings.position && settings.position.limit){
			query.setPosition(new QueryPosition(0, settings.position.limit));
		}

		return query;
	}

	toJSON(){
		return {
			$schema: 'bmoor-crud:structure',
			name: this.name,
			fields: this.fields.map(
				field => field.toJSON()
			)
		};
	}
}

module.exports = {
	types,
	actionExtend,
	buildActions,
	buildInflate,
	buildDeflate,
	Structure
};
