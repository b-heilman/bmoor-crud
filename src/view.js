
const {del} = require('bmoor/src/core.js');
const {create} = require('bmoor/src/lib/error.js');

async function runStatement(view, base, ctx){
	if (!(view.connector&&view.connector.execute)){
		console.log('refusing to run ->', view.schema.name, ctx);
		throw new Error('no connector defined: '+view.schema.name);
	}
	
	return await view.connector.execute(base, ctx);
}

async function runMap(arr, view, ctx){
	const mapFn = view.buildMap(ctx);
	const inflateFn = view.schema.actions.inflate;

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

	if (view.settings.inflate){
		return rtn.map(view.settings.inflate);
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
			const op = field[type];

			if (typeof(op) === 'string'){
				if (old){
					return async function(datum, ctx){
						await old(datum, ctx);

						if (!ctx.hasPermission(op)){
							del(datum, field.external);
						}
					};
				} else {
					return async function(datum, ctx){
						if (!ctx.hasPermission(op)){
							del(datum, field.external);
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
	constructor(schema, connector, settings={}){
		this.schema = schema;
		this.settings = settings;
		this.cleaners = {};
		this.connector = connector;
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
			cleaner = buildCleaner(type, this.schema.getFields());

			this.cleaners[type] = cleaner;
		}

		return cleaner;
	}

	async clean(type, datum, ctx){
		const cleaner = this.buildCleaner(type);

		datum = this.schema.clean(type, datum);

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
		if (this._filterFactory){
			return this._filterFactory(ctx);
		} else {
			return null;
		}
	}

	async create(datum, stmt, ctx){
		if (!this.connector){
			throw create(`missing create connector for ${this.schema.name}`, {
				code: 'BMOOR_CRUD_VIEW_CREATE_CONNECTOR'
			});
		}

		const cleaned = await this.clean('create', datum, ctx);

		const payload = this.schema.actions.create ?
			this.schema.actions.create(cleaned, cleaned, ctx) : cleaned;

		stmt.method = 'create';
		stmt.payload = this.schema.actions.deflate ?
			this.schema.actions.deflate(payload, ctx) : payload;

		if (this.settings.deflate){
			stmt.payload = this.settings.deflate(stmt.payload);
		}

		return runMap(
			await runStatement(this, stmt, ctx), 
			this, 
			ctx
		);
	}

	async read(stmt, ctx){
		if (!this.connector){
			throw create(`missing read connector for ${this.schema.name}`, {
				code: 'BMOOR_CRUD_VIEW_READ_CONNECTOR'
			});
		}

		stmt.method = 'read';
		
		return runFilter(
			await runMap( // converts from internal => external
				await runStatement(this, stmt, ctx), 
				this, 
				ctx
			), 
			this, 
			ctx
		);
	}

	async update(delta, tgt, stmt, ctx){
		if (!this.connector){
			throw create(`missing update connector for ${this.schema.name}`, {
				code: 'BMOOR_CRUD_VIEW_UPDATE_CONNECTOR'
			});
		}

		const cleaned = await this.clean('update', delta, ctx);

		const payload = this.schema.actions.update ?
			this.schema.actions.update(cleaned, tgt, ctx) : cleaned;

		stmt.method = 'update';
		stmt.payload = this.schema.actions.deflate ?
			this.schema.actions.deflate(payload, ctx) : payload;

		return runMap(
			await runStatement(this, stmt, ctx), 
			this,
			ctx
		);
	}

	async delete(stmt, ctx){
		if (!this.connector){
			throw create(`missing readMany connector for ${this.schema.name}`, {
				code: 'BMOOR_CRUD_VIEW_DELETE_CONNECTOR'
			});
		}

		stmt.method = 'delete';

		return runStatement(this, stmt, ctx);
	}
}
	
module.exports = {
	View
};
