
const {Config} = require('bmoor/src/lib/config.js');
const {makeGetter, makeSetter} = require('bmoor/src/core.js');
const {apply} = require('bmoor/src/lib/error.js');

const {Field} = require('./field.js');

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

function actionExtend(op, incoming, outgoing, old, oldBefore = true){
	const getter = makeGetter(incoming);
	const setter = makeSetter(outgoing);

	if (old){
		if (oldBefore){
			return function(tgt, src, ctx){
				op(old(tgt, src, ctx), src, setter, getter, ctx);

				return tgt;
			};
		} else {
			return function(tgt, src, ctx){
				 old(op(tgt, src, setter, getter, ctx), src, ctx);

				return tgt;
			};
		}
	} else {
		return function(tgt, src, ctx){
			op(tgt, src, setter, getter, ctx);

			return tgt;
		};
	}
}

function buildActions(actions, field){
	const path = field.path;
	const reference = field.reference;
	const storagePath = field.storagePath;
	
	const settings = field.settings;

	if (settings.onCreate){
		actions.create = actionExtend(settings.onCreate, path, path, actions.create);
	}

	if (settings.onUpdate){
		actions.update = actionExtend(settings.onUpdate, path, path, actions.update);
	}

	// inflate are changes out of the database
	if (settings.onInflate){
		actions.inflate = actionExtend(settings.onInflate, reference, path, actions.inflate);
	}

	// deflate are changes into the database
	if (settings.onDeflate){
		actions.deflate = actionExtend(settings.onDeflate, path, storagePath, actions.deflate);
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

function buildProperties(properties, field){
	const path = field.path;

	const settings = field.settings;

	if (settings.create){
		properties.create.push(path);
	}

	if (settings.read){
		properties.read.push(path);
	}

	if (settings.update){
		properties.update.push(path);

		if (settings.updateType){
			properties.updateType[path] = settings.updateType;
		}
	}

	if (settings.index){
		properties.index.push(path);
	}

	if (settings.query){
		properties.query.push(path);
	}

	if (settings.key){
		if (properties.key){
			throw new Error(`bmoor-data.Model does not support compound keys: (${properties.key}, ${path})`);
		}

		properties.key = path;
	}

	return properties;
}

function buildInflate(actions, fields){
	const inflate = actions.inflate;

	const mutator = fields.reduce(
		(old, field) => {
			if (field.settings.onInflate){
				// this means the mapping is handled by the function and is already
				// being passed in
				return old;
			} else {
				// alias - cleanup
				const getter = makeGetter(field.reference);
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

	if (inflate && mutator){
		return function mutateInflaterFn(datum, ctx){
			return inflate(mutator(datum), datum, ctx);
		};
	} else if (!mutator){
		return function inflaterFn(datum, ctx){
			return inflate({}, datum, ctx);
		};
	} else {
		return function mutatorFn(datum/*, ctx*/){
			return mutator(datum);
		};
	}
}

function buildDeflate(actions, fields){
	const deflate = actions.deflate;

	const mutator = fields.reduce(
		(old, field) => {
			if (field.settings.onDeflate){
				return old;
			} else {
				const getter = makeGetter(field.path);
				// alias - cleanup
				const setter = makeSetter(field.storagePath);

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

	if (deflate && mutator){
		return function mutateDeflaterFn(datum, ctx){
			return deflate(mutator(datum), datum, ctx);
		};
	} else if (!mutator){
		return function deflaterFn(datum, ctx){
			return deflate({}, datum, ctx);
		};
	} else {
		return function mutatorFn(datum/*, ctx*/){
			return mutator(datum);
		};
	}
}

class Structure {
	constructor(name){
		this.name = name;
	}

	configure(settings){
		this.settings = settings;
		
		this.fields = [];
		this.index = {};
		this.actions = null;
		this.properties = null;
	}

	async build(){
		if (!this.actions || !this.properties){
			this.actions = this.fields.reduce(buildActions, {
				mutates: false
			});

			this.properties = this.fields.reduce(buildProperties, {
				create: [],
				read: [],
				update: [],
				updateType: {},
				key: null,
				index: [],
				query: []
			});

			this.actions.inflate = buildInflate(this.actions, this.fields);
			this.actions.deflate = buildDeflate(this.actions, this.fields);
		}
	}

	assignField(field){
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
				const op = field.settings[type]; // I don't personally like this...
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

							console.log(ex);

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

	clean(type, datum){
		if (!this.properties){
			this.build();
		}

		return this.properties[type]
		.reduce(
			(agg, field) => {
				if (field in datum){
					agg[field] = datum[field];
				}

				return agg;
			}, 
			{}
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

	toJSON(){
		console.log('--structure--', this.name);
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
	buildProperties,
	buildInflate,
	buildDeflate,
	Structure
};
