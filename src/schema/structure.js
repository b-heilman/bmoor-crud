
const {Config} = require('bmoor/src/lib/config.js');
const {makeGetter} = require('bmoor/src/core.js');
const {apply, create} = require('bmoor/src/lib/error.js');

const {Field} = require('./field.js');
const {Path} = require('../graph/path.js');
const {StatementField} = require('./statement/field.js');
const {StatementFilter} = require('./statement/filter.js');
const {StatementParam} = require('./statement/param.js');
const {QueryJoin} = require('./query/join.js');
const {QuerySort} = require('./query/sort.js');
const {QueryPosition} = require('./query/position.js');

const major = Symbol('major');
const minor = Symbol('minor');
const none = Symbol('none');

const createMode = Symbol('create');
const updateMode = Symbol('update');

const config = new Config({
	changeTypes: {
		major,
		minor,
		none
	},
	changeRankings: {
		[major]: 2,
		[minor]: 1,
		[none]: 0
	},
	writeModes: {
		create: createMode,
		update: updateMode
	}
});

const usages = new Config({
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

function actionExtend(op, getter, setter, old, cfg){
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
		// this is to allow one field type to watch another field type
		if (cfg.target){
			cfg.getTarget = makeGetter(cfg.target);
		}
	}

	if (settings.onCreate){
		actions.create = actionExtend(
			settings.onCreate,
			field.externalGetter,
			field.externalSetter, 
			actions.create, 
			cfg
		);
	}

	if (settings.onUpdate){
		actions.update = actionExtend(
			settings.onUpdate,
			field.externalGetter,
			field.externalSetter, 
			actions.update,
			cfg
		);
	}

	// inflate are changes out of the database
	if (settings.onInflate){
		actions.inflate = actionExtend(
			settings.onInflate, 
			field.internalGetter,
			field.externalSetter,
			actions.inflate,
			cfg
		);
	}

	// deflate are changes into the database
	if (settings.onDeflate){
		actions.deflate = actionExtend(
			settings.onDeflate, 
			field.externalGetter, 
			field.internalSetter, 
			actions.deflate, 
			cfg
		);
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

function buildInflate(baseInflate, fields){
	const mutator = fields.reduce(
		(old, field) => {
			const structureSettings = (field.original ?
				field.original.structure : field.structure).incomingSettings;
			
			if (field.incomingSettings.onInflate){
				// this means the mapping is handled by the function and is already
				// being passed in
				return old;
			} else {
				// TODO: isFlat needs to come from the adapter? but how...
				// TODO: should the below be internalGetter and the field always
				//   knows its context based on reference?
				const getter = structureSettings.isFlat ?
					(datum) => datum[field.reference] : field.internalGetter;
				const setter = field.externalSetter;

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
	} else if (baseInflate){
		return function inflaterFn(datum, ctx){
			return baseInflate({}, datum, ctx);
		};
	} else if (mutator){
		return function mutatorFn(datum/*, ctx*/){
			return mutator(datum);
		};
	} else {
		return (datum) => datum;
	}
}

function buildDeflate(baseDeflate, fields){
	const mutator = fields.reduce(
		(old, field) => {
			const structureSettings = (field.original ?
				field.original.structure : field.structure).incomingSettings;

			if (field.incomingSettings.onDeflate){
				return old;
			} else {
				const getter = field.externalGetter;
				const setter = structureSettings.isFlat ?
					function(datum, value) {datum[field.storagePath] = value;} :
					field.internalSetter;

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
	} else if (baseDeflate){
		return function deflaterFn(datum, ctx){
			return baseDeflate({}, datum, ctx);
		};
	} else if (mutator){
		return function mutatorFn(datum/*, ctx*/){
			return mutator(datum);
		};
	} else {
		return (datum) => datum;
	}
}

// TODO: do I want to want to create a builder class?
function buildParam(field, v, Class){
	if (v && typeof(v) === 'object'){
		if (Array.isArray(v)){
			return new Class(field, v, '=');
		} else {
			return Object.keys(v).map(
				op => new Class(field, v[op], op)
			);
		}
	} else {
		
		return new Class(field, v, '=');
	}
}

function buildSorts(query, sorts){
	sorts.split(',')
		.map((option, pos) => {
			option = option.trimStart();

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

				base = option.substr(1, pos-1);
				option = option.substr(pos+1);
			} else if (option[0] === '.'){
				option = option.substr(1);
			}

			query.addSorts(base, [new QuerySort(option, pos, ascending)]);
		});
}

function buildValidator(old, field, validation){
	function validate(datum, mode=updateMode){
		const rtn = [];
		const value = field.externalGetter(datum);

		if (validation.required){
			if (!value && (mode === createMode || value !== undefined)){
				rtn.push({
					path: field.path,
					message: 'can not be empty'
				});
			}
		}

		return rtn;
	}

	if (old){
		return function(datum, mode){
			return old(datum, mode).concat(validate(datum, mode));
		};
	} else {
		return validate;
	}
}

function compareChanges(was, now){
	let rtn = was;

	if (now){
		if (!was){
			rtn = now; 
		} else {
			const rankings = config.get('changeRankings');

			if (rankings[now] > rankings[was]){
				rtn = now;
			}
		}
	}
	
	return rtn;
}

function buildChangeCompare(old, field, type){
	if (old){
		return function(delta){
			return compareChanges(
				old(delta),
				field.externalGetter(delta) === undefined ? null : type
			);
		};
	} else {
		return function(delta){
			return field.externalGetter(delta) === undefined ? 
				config.get('changeTypes.none') : type;
		};
	}
}

function buildSettings(properties, field){
	const settings = field.incomingSettings;

	if (settings.validation){
		properties.validation = buildValidator(
			properties.validation,
			field,
			settings.validation
		);
	}

	if (settings.updateType){
		properties.calculateChangeType = buildChangeCompare(
			properties.calculateChangeType,
			field,
			settings.updateType
		);
	}

	return properties;
}

async function addAccessorsToQuery(accessors, query, nexus){
	return accessors.reduce(
		async (prev, accessor) => {
			let relationship = null;
			let from = null;
			let to = null;

			prev = await prev;

			let pSeries = prev.series;
			let aSeries = accessor.series;

			const model = nexus.getModel(accessor.model);
			query.setModel(aSeries, model);
			
			// this ensures everything is linked accordingly
			// await addStuff(this, prev, subAccessor);
			if (accessor.target) {
				relationship = nexus.mapper.getRelationship(
					accessor.model, prev.model, accessor.target
				);
				from = aSeries;
				to = pSeries;
			} else {
				relationship = nexus.mapper.getRelationship(
					prev.model, accessor.model, prev.field
				);
				from = pSeries;
				to = aSeries;
			}

			if (!relationship){
				throw create(`accessor relationship failed: ${prev.model} -> ${accessor.model}`, {
					code: 'BMOOR_CRUD_STRUCTURE_RELATIONSHIP',
					context: {
						accessorModel: accessor.model,
						accessorField: accessor.target,
						prevModel: prev.model,
						prevField: prev.field
					}
				});
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
}

class Structure {
	constructor(name, nexus){
		this.name = name;
		this.nexus = nexus;
	}

	async configure(settings){
		this.incomingSettings = settings;
		
		this.fields = [];
		this.index = {};
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

		if (!this.settings){
			this.settings = this.fields.reduce(buildSettings, {
				validation: null,
				calculateChangeType: null
			});
		}
	}

	assignField(field){
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
		if (settings.usage){
			// this allows types to define onCreate, onRead, onUpdate, onDelete
			Object.assign(settings, usages.get(settings.usage)||{});
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
				const op = field.incomingSettings[type];

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

	// generates the base query object for the class, stubed under structure
	getBaseQuery(){
		throw new Error('must be extended');
	}

	// used to extend all statements (query or executable).  These are contextless
	// properties
	async extendBaseStatement(statement){
		const filters = this.incomingSettings.filters;
		if (filters){
			Object.keys(filters).map(
				field => {
					let path = null;
					let series = statement.base;

					const param = filters[field];

					if (field[0] === '$'){
						const pos = field.indexOf('.');

						series = field.substr(1, pos-1);
						path = field.substr(pos+1);
					} else {
						if (field[0] === '.'){
							field = field.substr(1);
						}

						path = field;
					}

					statement.addFilters(
						series,
						[buildParam(path, param, StatementFilter)]
					);
				}
			);
		}
	}

	// create a base statement and extend it
	async prepareBaseQuery(){
		const query = this.getBaseQuery();

		await this.extendBaseStatement(query);

		const sorts = this.incomingSettings.sort;
		if (sorts){
			buildSorts(query, sorts);
		}

		return query;
	}

	// Add content to a statement based on the given context.  This will be run
	// each invocation, unlike the prepare which is univeral across all contexts
	async extendStatement(statement, settings, ctx){
		// this is in extended because some fields are based on permission.
		// I could preload some and do the rest, but for now this is how
		// it will work
		(await this.testFields('read', ctx))
		.forEach(
			(field) => {
				statement.addFields(field.series, [
					new StatementField(field.storagePath, field.reference || null)
				]);
			}
		);

		// parameters we can querying off of, must already be inside the structure
		/** structure
		 * {
		 * 	[inside series].[inside property]: [inside value]
		 * }
		 **/
		 const params = settings.params;
		if (params){
			Object.keys(params).map(
				field => {
					let path = null;
					let series = statement.base;

					const param = params[field];

					if (field[0] === '$'){
						const pos = field.indexOf('.');

						series = field.substr(1, pos-1);
						path = field.substr(pos+1);
					} else {
						if (field[0] === '.'){
							field = field.substr(1);
						}

						path = field;
					}

					statement.addParams(
						series,
						[buildParam(path, param, StatementParam)]
					);
				}
			);
		}
	}

	// assigns query specific fields
	async extendQuery(query, settings, ctx){
		await this.extendStatement(query, settings, ctx);

		// this is the query property.  It allows you to 'join in' from the outside
		/** structure
		 * {
		 * 	[[outside property][outside series] > [inside series]]: [outside value]
		 * }
		 **/
		if (settings.joins){
			await settings.joins.reduce(
				async (prom, path) => {
					await prom;
					
					path = path.trimStart();

					if (path[0] === '.'){
						/**
						 * I want to allow .property notion here, but I don't want to break
						 * .aField$series so I have to check
						 **/
						const seriesPos = path.indexOf('$');

						if (seriesPos === -1){
							path = '$'+query.base+path;
						}
					}

					const access = (new Path(path)).access;

					// links in are [model].value > [existingModel]
					const mountAccessor = access[access.length-1];
					const mountSeries = mountAccessor.series;

					// this verified the mount point is inside the model
					if (!query.hasSeries(mountSeries)){
						throw new Error(`unable to mount: ${mountSeries} from ${path}`);
					}

					await addAccessorsToQuery(
						access, query, this.nexus
					);
					
					const rootAccessor = access[0];
					
					const model = this.nexus.getModel(rootAccessor.model); // has to be defined by now
					query.setModel(rootAccessor.series, model);
				}, 
				Promise.resolve(true)
			);
		}

		if (settings.sort){
			buildSorts(query, settings.sort);
		}

		if (settings.position && settings.position.limit){
			query.setPosition(new QueryPosition(0, settings.position.limit));
		}

		return query;
	}

	getChangeType(delta){
		if (this.settings.calculateChangeType){
			return this.settings.calculateChangeType(delta);
		} else {
			return none;
		}
	}

	validate(delta, mode){
		if (this.settings.validation){
			return this.settings.validation(delta, mode);
		} else {
			return [];
		}
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
	usages,
	config,
	actionExtend,
	buildActions,
	buildInflate,
	buildDeflate,
	buildParam,
	compareChanges,
	addAccessorsToQuery,
	Structure
};
