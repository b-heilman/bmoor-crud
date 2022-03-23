const {apply, create} = require('bmoor/src/lib/error.js');
const {implode} = require('bmoor/src/object.js');
const {makeGetter} = require('bmoor/src/core.js');

function actionExtend(op, getter, setter, old, cfg) {
	if (old) {
		return function (datum, ctx) {
			op(old(datum, ctx), setter, getter, cfg, ctx);

			return datum;
		};
	} else {
		return function (datum, ctx) {
			op(datum, setter, getter, cfg, ctx);

			return datum;
		};
	}
}

function buildActions(actions, field) {
	const settings = field.incomingSettings;

	let cfg = {};

	if (settings.cfg) {
		cfg = settings.cfg;
		// this is to allow one field type to watch another field type
		if (cfg.target) {
			cfg.getTarget = makeGetter(cfg.target);
		}
	}

	if (settings.onCreate) {
		actions.create = actionExtend(
			settings.onCreate,
			field.externalGetter,
			field.externalSetter,
			actions.create,
			cfg
		);
	}

	if (settings.onUpdate) {
		actions.update = actionExtend(
			settings.onUpdate,
			field.externalGetter,
			field.externalSetter,
			actions.update,
			cfg
		);
	}

	// inflate are changes out of the database
	if (settings.onInflate) {
		actions.inflate = actionExtend(
			settings.onInflate,
			field.externalGetter,
			field.externalSetter,
			actions.inflate,
			cfg
		);
	}

	// deflate are changes into the database
	if (settings.onDeflate) {
		actions.deflate = actionExtend(
			settings.onDeflate,
			field.externalGetter,
			field.externalSetter,
			actions.deflate,
			cfg
		);
	}

	return actions;
}

function buildTransformer(opProperty, getter, setter) {
	return function (baseFn, field) {
		const op = field.incomingSettings[opProperty];

		return function (datum, ctx) {
			const rtn = baseFn(datum, ctx);

			const value = field[getter](datum);

			if (
				value !== undefined &&
				(op === true || (typeof op === 'string' && ctx.hasPermission(op)))
			) {
				field[setter](rtn, value);
			}

			return rtn;
		};
	};
}

class StructureActions {
	constructor(fields) {
		this.fields = fields;
		this.index = fields.reduce((agg, field) => {
			agg[field.path] = field;

			return agg;
		}, {});

		fields.reduce(buildActions, this);

		// TODO: I could probably optimize this by not always generating the full convert,
		//   but I'm going to be lazy and do so.  I'm getting into premature optimization
		this.convertFromStorage = fields.reduce(
			buildTransformer('read', 'internalGetter', 'externalSetter'),
			function () {
				return {};
			}
		);

		this.convertFromCreate = fields.reduce(
			buildTransformer('create', 'externalGetter', 'internalSetter'),
			function () {
				return {};
			}
		);

		this.convertFromUpdate = fields.reduce(
			buildTransformer('update', 'externalGetter', 'internalSetter'),
			function () {
				return {};
			}
		);
	}

	testField(field, type, ctx) {
		// if I need to in the future, I can load the permission here then run the test
		const op = field.incomingSettings[type];

		if (op) {
			if (typeof op === 'string') {
				try {
					return ctx.hasPermission(op);
				} catch (ex) {
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
				return true;
			}
		}

		return false;
	}

	testFields(type, ctx) {
		return this.fields.reduce((agg, field) => {
			const test = this.testField(field, type, ctx);

			if (test) {
				agg.push(field);
			}

			return agg;
		}, []);
	}

	remap(schema) {
		const imploded = implode(schema);

		return new StructureActions(
			Object.keys(imploded).map((path) => {
				const field = this.index[imploded[path]];

				if (!field) {
					throw create(`unknown field: ${imploded[path]}`, {
						code: 'BMOOR_CRUD_STRUCTURE_ACTION_FIELD',
						context: {
							available: Object.keys(this.index)
						}
					});
				}

				return field.extend(path);
			})
		);
	}
}

module.exports = {
	buildTransformer,
	StructureActions
};
