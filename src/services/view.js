const {del} = require('bmoor/src/core.js');

const {Querier} = require('./querier.js');
const {Executor} = require('./executor.js');

async function runMap(arr, view, ctx) {
	const cleanFn = view.actions.cleanForInflate;
	const inflateFn = view.actions.inflate;

	let rtn = null;

	if (mapFn) {
		if (inflateFn) {
			rtn = await Promise.all(arr.map((datum) => inflateFn(cleanFn(datum, ctx), ctx)));
		} else {
			rtn = await Promise.all(arr.map((datum) => cleanFn(datum, ctx)));
		}
	} else if (inflateFn) {
		rtn = arr.map((datum) => {
			return inflateFn(datum, ctx);
		});
	} else {
		rtn = arr;
	}

	if (view.incomingSettings.inflate) {
		return rtn.map(view.incomingSettings.inflate);
	} else {
		return rtn;
	}
}

async function runFilter(arr, view, ctx) {
	const filterFn = await view.buildFilter(ctx);

	if (filterFn) {
		return arr.filter(filterFn);
	} else {
		return arr;
	}
}

function buildInflate(baseInflate, fields) {
	const mutator = fields.reduce((old, field) => {
		const structureSettings = (
			field.original ? field.original.structure : field.structure
		).incomingSettings;

		if (field.incomingSettings.onInflate) {
			// this means the mapping is handled by the function and is already
			// being passed in
			return old;
		} else {
			// TODO: isFlat needs to come from the adapter? but how...
			// TODO: should the below be internalGetter and the field always
			//   knows its context based on reference?
			const getter = structureSettings.isFlat
				? (datum) => datum[field.reference]
				: field.internalGetter;
			const setter = field.externalSetter;

			if (old) {
				return function (src) {
					const tgt = old(src);

					const val = getter(src);
					if (val !== undefined) {
						setter(tgt, val);
					}

					return tgt;
				};
			} else {
				return function (src) {
					const tgt = {};

					const val = getter(src);
					if (val !== undefined) {
						setter(tgt, val);
					}

					return tgt;
				};
			}
		}
	}, null);

	if (baseInflate && mutator) {
		return function mutateInflaterFn(datum, ctx) {
			return baseInflate(mutator(datum), datum, ctx);
		};
	} else if (baseInflate) {
		return function inflaterFn(datum, ctx) {
			return baseInflate({}, datum, ctx);
		};
	} else if (mutator) {
		return function mutatorFn(datum /*, ctx*/) {
			return mutator(datum);
		};
	} else {
		return (datum) => datum;
	}
}

function buildDeflate(baseDeflate, fields) {
	const mutator = fields.reduce((old, field) => {
		const structureSettings = (
			field.original ? field.original.structure : field.structure
		).incomingSettings;

		if (field.incomingSettings.onDeflate) {
			return old;
		} else {
			const getter = field.externalGetter;
			const setter = !structureSettings.isFlat
				? field.internalSetter
				: function (datum, value) {
						datum[field.storagePath] = value;
				  };

			if (old) {
				return function (src) {
					const tgt = old(src);

					const val = getter(src);
					if (val !== undefined) {
						setter(tgt, val);
					}

					return tgt;
				};
			} else {
				return function (src) {
					const tgt = {};

					const val = getter(src);
					if (val !== undefined) {
						setter(tgt, val);
					}

					return tgt;
				};
			}
		}
	}, null);

	if (baseDeflate && mutator) {
		return function mutateDeflaterFn(datum, ctx) {
			return baseDeflate(mutator(datum), datum, ctx);
		};
	} else if (baseDeflate) {
		return function deflaterFn(datum, ctx) {
			return baseDeflate({}, datum, ctx);
		};
	} else if (mutator) {
		return function mutatorFn(datum /*, ctx*/) {
			return mutator(datum);
		};
	} else {
		return (datum) => datum;
	}
}

function buildFieldOperator(type, fields, fn){
	const method = fields.reduce((old, field) => {
		const op = field.incomingSettings[type];

		if (op){
			if (old) {
				return async function (datum, ctx) {
					await old(datum, ctx);

					return fn(datum, field, op, ctx);
				};
			} else {
				return async function (datum, ctx) {
					return fn(datum, field, op, ctx);
				};
			}
		}

		return old;
	}, null);

	if (method) {
		return async function (datum, ctx) {
			await method(datum, ctx);

			return datum;
		};
	} else {
		return async function(datum){
			return datum;
		};
	}
}

function cleanResponse(datum, field, op, ctx){
	if (typeof op === 'string' && !ctx.hasPermission(op)) {
		del(datum, field.reference);
	}
}

function cleanIncominge(datum, field, op, ctx){
	if (typeof op === 'string' && !ctx.hasPermission(op)) {
		del(datum, field.path);
	}
}

class View {
	constructor(structure) {
		this.structure = structure;
		this.cleaners = {};
		this.hooks = {};
		this.security = {};

	}

	async configure(settings = {}) {
		this.incomingSettings = settings;
	}

	async build(){
		await this.structure.build();

		// TODO: now that I have things separated, do I really want this 
		//   logic here?
		/***
		 * Here's how permissions / security will work.  I am going to treat
		 * the framework like a red/green network topography.  Everything
		 * services and schemas will be assumed sanitized, and controllers
		 * will sanitize any incoming things.  This reduces the number of 
		 * unneccisary copies made of data. So cleanFor are used to apply permissions
		 * to a known data shape and copyFor is to sanitize data from the outside.
		 * 
		 * Deflate will act as a copyFor, so I don't need one for create or update
		 ***/
		this.actions = {
			// source read => cleanForInflate => inflate
			inflate: buildInflate(
				this.structure.actions.inflate,
				this.structure.getFields(),
				this.structure.incomingSettings
			),
			cleanForInflate: buildFieldOperator(
				'read', 
				this.structure.getFields(),
				cleanResponse
			),
			// update => cleanForUpdate => deflate
			// create => cleanForCreate => deflate
			deflate: buildDeflate(
				this.structure.actions.deflate,
				this.structure.getFields(),
				this.structure.incomingSettings
			),
			cleanForUpdate: buildFieldOperator(
				'update', 
				this.structure.getFields(),
				cleanIncominge
			),
			cleanForCreate = buildFieldOperator(
				'create', 
				this.structure.getFields(),
				cleanIncominge
			)
		};
	}

	async buildFilter(ctx) {
		if (this.security.filterFactory) {
			return this.security.filterFactory(ctx);
		} else {
			return null;
		}
	}

	async run(stmt, ctx, settings) {
		await stmt.link(this.structure.nexus);

		return stmt.run(ctx, settings);
	}

	async process(stmt, ctx, settings = {}) {
		return runFilter(
			await runMap(
				// converts from internal => external
				await this.run(stmt, ctx, settings),
				this,
				ctx
			),
			this,
			ctx
		);
	}

	async query(query, ctx, settings = {}) {
		return this.process(
			new Querier('view:' + this.structure.name, query),
			ctx,
			settings
		);
	}

	async execute(exe, ctx, settings = {}) {
		return this.process(
			new Executor('view:' + this.structure.name, exe),
			ctx,
			settings
		);
	}

	async getChangeType(datum, id = null, ctx = null) {
		let delta = datum;

		if (id) {
			const target = await this.read(id, ctx);

			if (target) {
				delta = this.structure.getFields().reduce((agg, field) => {
					const incomingValue = field.externalGetter(datum);
					const existingValue = field.externalGetter(target);

					if (incomingValue !== existingValue && incomingValue !== undefined) {
						field.externalSetter(agg, incomingValue);
					}

					return agg;
				}, {});
			}
		}

		return this.structure.getChangeType(delta);
	}

	async validate(delta, mode, ctx) {
		const security = this.security;

		const errors = this.structure.validate(delta, mode);

		return security.validate
			? errors.concat(await security.validate(delta, mode, ctx))
			: errors;
	}

	toJSON() {
		return {
			$schema: 'bmoor-crud:view',
			structure: this.structure
		};
	}
}

module.exports = {
	runMap,
	runFilter,
	View
};
