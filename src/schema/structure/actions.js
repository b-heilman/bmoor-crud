
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
	const path = field.path;
	const reference = field.reference;
	const storagePath = field.storagePath;

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

	if (path !== reference) {
		// data changes from internal to external
		actions.mutatesInflate = true;
	}

	if (path !== storagePath) {
		// data changes from external to internal
		actions.mutatesDeflate = true;
	}

	return actions;
}

function buildTransformer(opProperty, getter, setter){
	return function(baseFn, field) {
		const op = field.incomingSettings[opProperty];

		return function(datum, ctx){
			const rtn = baseFn(datum, ctx);

			const value = field[getter](datum);
			
			if (value !== undefined && (op === true ||
					(typeof op === 'string' && ctx.hasPermission(op)))
			){

				field[setter](rtn, value);
			}

			return rtn;
		};
	};
}

class StructureActions {
	constructor(fields){
		this.mutates = false;

		fields.reduce(buildActions, this);

		// TODO: I could probably optimize this by not always generating the full convert,
		//   but I'm going to be lazy and do so.  I'm getting into premature optimization
		this.convertFromStorage = fields.reduce(
			buildTransformer('read', 'internalGetter', 'externalSetter'),
			function(){
				return {};
			}
		);

		this.convertFromCreate = fields.reduce(
			buildTransformer('create', 'externalGetter', 'internalSetter'),
			function(){
				return {};
			}
		);

		this.convertFromUpdate = fields.reduce(
			buildTransformer('update', 'externalGetter', 'internalSetter'),
			function(){
				return {};
			}
		);
	}
}

module.exports = {
	buildTransformer,
	StructureActions
};
