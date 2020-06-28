
const {Config} = require('bmoor/src/lib/config.js');
const {makeGetter, makeSetter} = require('bmoor/src/core.js');
const {apply} = require('bmoor/src/lib/error.js');

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

model: {
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
	const external = field.external;
	const internal = field.alias || field.internal;

	if (field.onCreate){
		actions.create = actionExtend(field.onCreate, external, external, actions.create);
	}

	if (field.onUpdate){
		actions.update = actionExtend(field.onUpdate, external, external, actions.update);
	}

	// inflate are changes out of the database
	if (field.onInflate){
		actions.inflate = actionExtend(field.onInflate, internal, external, actions.inflate);
	}

	// deflate are changes into the database
	if (field.onDeflate){
		actions.deflate = actionExtend(field.onDeflate, external, internal, actions.deflate);
	}

	if (field.internal !== field.external){
		actions.mutates = true;
	}

	return actions;
}

function buildProperties(properties, field){
	if (field.create){
		properties.create.push(field.external);
	}

	if (field.read){
		properties.read.push(field.external);
	}

	if (field.update){
		properties.update.push(field.external);

		if (field.updateType){
			properties.updateType[field.external] = field.updateType;
		}
	}

	if (field.index){
		properties.index.push(field.external);
	}

	if (field.query){
		properties.query.push(field.external);
	}

	if (field.key){
		if (properties.key){
			throw new Error(`bmoor-data.Model does not support compound keys: (${properties.key}, ${field.external})`);
		}

		properties.key = field.external;
	}

	return properties;
}

function buildInflate(actions, fields){
	const inflate = actions.inflate;

	if (actions.mutates){
		const mutator = fields.reduce((old, field) => {
			if (field.onInflate){
				return old;
			} else {
				const getter = makeGetter(field.alias || field.internal);
				const setter = makeSetter(field.external);

				if (old){
					return function(src){
						const tgt = old(src);

						setter(tgt, getter(src));

						return tgt;
					};
				} else {
					return function(src){
						const tgt = {};

						setter(tgt, getter(src));

						return tgt;
					};
				}
			}
		}, null);

		if (inflate){
			return function mutateInflater(datum, ctx){
				return inflate(mutator(datum), datum, ctx);
			};
		} else {
			return mutator;
		}
	} else if (inflate){
		return function inflater(datum, ctx){
			return inflate(datum, datum, ctx);
		};
	}
}

function buildDeflate(actions, fields){
	const deflate = actions.deflate;

	if (actions.mutates){
		const mutator = fields.reduce((old, field) => {
			if (field.onDeflate){
				return old;
			} else {
				const getter = makeGetter(field.external);
				const setter = makeSetter(field.alias || field.internal);

				if (old){
					return function(src){
						const tgt = old(src);

						setter(tgt, getter(src));

						return tgt;
					};
				} else {
					return function(src){
						const tgt = {};

						setter(tgt, getter(src));

						return tgt;
					};
				}
			}
		}, null);

		return function mutateDeflater(datum, ctx){
			return deflate(mutator(datum), datum, ctx);
		};
	} else if (deflate){
		return function deflater(datum, ctx){
			return deflate(datum, datum, ctx);
		};
	}
}

class Schema {
	constructor(){
		this.fields = [];
		this.index = {};
		this.actions = null;
		this.properties = null;
	}

	build(){
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

	/***
	 * 
	 ***/
	addField(field){
		if (field.type){
			// this allows types to define onCreate, onRead, onUpdate, onDelete
			Object.assign(field, types.get(field.type)||{});
		}

		this.index[field.external] = field;
		this.fields.push(field);

		return field;
	}

	getField(external){
		return this.index[external];
	}

	getFields(){
		return this.fields;
	}

	hasModel(model){
		let found = null;

		for (let i = 0, c = this.fields.length; i < c && !found; i++){
			const field = this.fields[i];

			if (field.model.name === model){
				found = field;
			}
		}

		return found;
	}

	findField(model, internal){
		let found = null;

		for (let i = 0, c = this.fields.length; i < c && !found; i++){
			const field = this.fields[i];

			if (field.internal === internal && field.model.name === model){
				found = field;
			}
		}

		return found;
	}

	async testFields(type, ctx){
		return this.fields.reduce(
			async (prom, field) => {
				const agg = await prom;
				const op = field[type];

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
									external: field.external,
									model: field.model.name
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
}

module.exports = {
	types,
	actionExtend,
	buildActions,
	buildProperties,
	buildInflate,
	buildDeflate,
	Schema
};
