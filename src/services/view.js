
const {del} = require('bmoor/src/core.js');

async function runMap(arr, view, ctx){
	const mapFn = view.buildMap(ctx);
	const inflateFn = view.structure.actions.inflate;

	let rtn = null;

	if (mapFn){
		if (inflateFn){
			rtn = await Promise.all(
				arr.map(
					datum => mapFn(inflateFn(datum, ctx))
				)
			);
		} else {
			rtn = await Promise.all(
				arr.map(mapFn)
			);
		}
	} else if (inflateFn){
		rtn = arr.map(
			datum => inflateFn(datum, ctx)
		);
	} else {
		rtn = arr;
	}

	if (view.incomingSettings.inflate){
		return rtn.map(view.incomingSettings.inflate);
	} else {
		return rtn;
	}
}

async function runFilter(arr, view, ctx){
	const filterFn = await view.buildFilter(ctx);

	if (filterFn){
		return arr.filter(filterFn);
	} else {
		return arr;
	}
}

function buildCleaner(type, fields){
	const cleaner = fields.reduce(
		(old, field) => {
			const op = field.incomingSettings[type];

			if (typeof(op) === 'string'){
				if (old){
					return async function(datum, ctx){
						await old(datum, ctx);

						if (!ctx.hasPermission(op)){
							del(datum, field.path);
						}
					};
				} else {
					return async function(datum, ctx){
						if (!ctx.hasPermission(op)){
							del(datum, field.path);
						}
					};
				}
			}

			return old;
		},
		null
	);

	if (cleaner){
		return async function(datum, ctx){
			await cleaner(datum, ctx);

			return datum;
		};
	} else {
		return null;
	}
}

class View {
	constructor(structure){
		this.structure = structure; 
		this.cleaners = {};
		this.hooks = {};
		this.security = {};
	}

	async configure(settings={}){
		this.incomingSettings = settings;
	}

	// returns a function to clean multiple datums from this instance
	/*
	 * I am defaulting preclean to false, as this view will already be
	 * defining what fields are requested, so the clean will be double duty
	 * leaving it here though incase anyone wants to be over zealous with 
	 * security.
	 */
	buildCleaner(type){
		let cleaner = this.cleaners[type];

		if (!(type in this.cleaners)){
			cleaner = buildCleaner(type, this.structure.getFields());

			this.cleaners[type] = cleaner;
		}

		return cleaner;
	}

	async clean(type, datum, ctx){
		const cleaner = this.buildCleaner(type);

		datum = this.structure.clean(type, datum);

		if (cleaner){
			await cleaner(datum, ctx);
		}

		return datum;
	}

	buildMap(ctx){
		const readCleaner = this.buildCleaner('read');

		if (readCleaner){
			return async function(datum){
				return readCleaner(datum, ctx);
			};
		}

		return null;
	}

	async buildFilter(ctx){
		if (this.security.filterFactory){
			return this.security.filterFactory(ctx);
		} else {
			return null;
		}
	}

	async read(stmt, ctx){
		stmt.method = 'read';
		
		return runFilter(
			await runMap( // converts from internal => external
				await this.structure.execute(stmt, ctx), 
				this, 
				ctx
			), 
			this, 
			ctx
		);
	}

	toJSON(){
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
