
const {create} = require('bmoor/src/lib/error.js');

async function runStatement(service, base, ctx){
	base.model = service.model;
	base.fields = service._allowedFields ?
		service._allowedFields(ctx) : service.model.properties.read;

	const prepared = await service.connector.prepare(base, ctx);

	return await service.connector.execute(prepared);
}

async function runMap(arr, service, ctx){
	if (service._mapFactory){
		const fn = await service._mapFactory(ctx);

		return arr.map(fn);
	} else {
		return arr;
	}
}

async function runFilter(arr, service, ctx){
	if (service._filterFactory){
		const filter = await service._filterFactory(ctx);

		return arr.filter(filter);
	} else {
		return arr;
	}
}

let count = 1;

class Service {
	constructor(model, connector){
		this.count = count++;
		this.model = model;
		this.connector = connector;
	}

	decorate(decoration){
		Object.assign(this, decoration);
	}

	async create(proto, ctx){
		if (this._beforeCreate){
			await this._beforeCreate(proto, ctx);
		}

		if (!this.connector){
			throw create(`missing create connector for ${this.model.name}`, {
				code: 'BMOOR_DATA_SERVICE_CREATE_CONNECTOR'
			});
		}

		const res = await runStatement(this, {
			method: 'create',
			delta: this.model.properties.onCreate(
				this.model.cleanDelta(proto, 'create', ctx),
				ctx
			)
		}, ctx);

		const datum = (await runMap(res, this, ctx))[0];

		if (this._afterCreate){
			await this._afterCreate(datum, ctx);
		}

		if (ctx){
			ctx.addChange(this.model.name, 'create', datum);
		}

		return datum;
	}

	async read(id, ctx){
		if (!this.connector){
			throw create(`missing read connector for ${this.model.name}`, {
				code: 'BMOOR_DATA_SERVICE_READ_CONNECTOR'
			});
		}

		const rtn = await runStatement(this, {
			method: 'read',
			context: {
				[this.model.properties.key]: id
			}
		}, ctx);

		const datum = (await runFilter(
			await runMap(rtn, this, ctx), 
			this, 
			ctx
		))[0];
		
		if (!datum){
			throw create(`unable to view ${id} of ${this.model.name}`, {
				code: 'BMOOR_DATA_SERVICE_READ_FILTER',
				context: {
					id
				}
			});
		}

		return datum;
	}

	async readAll(ctx){
		if (!this.connector){
			throw create(`missing readAll connector for ${this.model.name}`, {
				code: 'BMOOR_DATA_SERVICE_READALL_CONNECTOR'
			});
		}

		const res = await runStatement(this, {
			method: 'read',
			context: null
		}, ctx);

		return runFilter(
			await runMap(res, this, ctx), 
			this, 
			ctx
		);
	}

	async readMany(ids, ctx){
		if (!this.connector){
			throw create(`missing readMany connector for ${this.model.name}`, {
				code: 'BMOOR_DATA_SERVICE_READMANY_CONNECTOR'
			});
		}

		const res = await runStatement(this, {
			method: 'read',
			context: {
				[this.model.properties.key]: ids
			}
		}, ctx);

		return runFilter(
			await runMap(res, this, ctx),
			this, 
			ctx
		);
	}

	async query(search, ctx){
		if (!this.connector){
			throw create(`missing query connector for ${this.model.name}`, {
				code: 'BMOOR_DATA_SERVICE_QUERY_CONNECTOR'
			});
		}

		if (this._beforeQuery){
			await this._beforeQuery(search, ctx);
		}

		const res = await runStatement(this, {
			method: 'read',
			context: this.model.getQuery(search)
		}, ctx);

		return runFilter(
			await runMap(res, this, ctx),
			this, 
			ctx
		);
	}

	async update(id, delta, ctx){
		if (!this.connector){
			throw create(`missing update connector for ${this.model.name}`, {
				code: 'BMOOR_DATA_SERVICE_UPDATE_CONNECTOR'
			});
		}

		const tgt = await this.read(id, ctx);

		if (this._beforeUpdate){
			await this._beforeUpdate(delta, tgt, ctx);
		}

		const rtn = await runStatement(this, {
			method: 'update',
			context: {
				[this.model.properties.key]: id
			},
			delta: this.model.properties.onUpdate(
				this.model.cleanDelta(delta, 'update'),
				tgt,
				ctx
			)
		}, ctx);

		// rtn is expected to be [] of one
		const datum = (await runMap(rtn, this, ctx))[0];

		if (this._afterUpdate){
			await this._afterUpdate(datum, tgt, ctx);
		}

		if (ctx){
			ctx.addChange(this.model.name, 'update', datum);
		}

		return datum;
	}

	/**
	 * Delete will only run off ids.  If you want to do a mass delete, you need to run a query
	 * and then interate over that.  It simplifies the logic, but does make mass deletion an
	 * issue.  I'm ok with that for now.
	 **/
	async delete(id, ctx){
		if (!this.connector){
			throw create(`missing readMany connector for ${this.model.name}`, {
				code: 'BMOOR_DATA_SERVICE_DELETE_CONNECTOR'
			});
		}

		const datum = await this.read(id, ctx);

		if (this._beforeDelete){
			await this._beforeDelete(datum, ctx);
		}

		await runStatement(this, {
			method: 'delete',
			context: {
				[this.model.properties.key]: id
			}
		}, ctx);

		if (this._afterDelete){
			await this._afterDelete(datum, ctx);
		}

		if (ctx){
			ctx.addChange(this.model.name, 'delete', datum);
		}

		return datum; // datum will have had onRead run against it
	}
}

module.exports = {
	Service
};
