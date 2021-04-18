
const {create} = require('bmoor/src/lib/error.js');

const {View} = require('./view.js');

async function massAccess(service, arr, ctx){
	if (service._canAccess){
		return (await Promise.all(
			arr.map(
				async (datum) => 
				(await service._canAccess(datum, ctx)) ? datum : null
			)
		)).filter();
	} else {
		return arr;
	}
}

class Crud extends View {
	
	decorate(decoration){
		Object.assign(this, decoration);
	}

	async create(proto, ctx){
		if (!ctx){
			throw create(`missing ctx in create of ${this.structure.name}`, {
				status: 500,
				code: 'BMOOR_CRUD_SERVICE_CREATE_CTX',
				context: {
					id
				}
			});
		}

		if (this._beforeCreate){
			await this._beforeCreate(proto, ctx, this);
		}

		if (this._canCreate){
			if (!(await this._canCreate(proto, ctx))){
				throw create(`now allowed to create instance of ${this.structure.name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_CREATE',
					context: {}
				});
			}
		}

		const datum = (
			await super.create(
				proto, 
				{
					model: this.structure.name
				}, 
				ctx
			)
		)[0];

		if (this._afterCreate){
			await this._afterCreate(datum, ctx, this);
		}

		if (ctx){
			ctx.addChange(
				this.structure.name, 
				'create', 
				this.structure.getKey(datum), 
				null, 
				datum
			);
		}

		return datum;
	}

	async read(id, ctx){
		if (!ctx){
			throw create(`missing ctx in read of ${this.structure.name}`, {
				status: 500,
				code: 'BMOOR_CRUD_SERVICE_READ_CTX',
				context: {
					id
				}
			});
		}

		await this.structure.build();

		const datum = (
			await super.read(
				await this.structure.getQuery(
					{[this.structure.properties.key]: id},
					{},
					ctx
				),
				ctx
			)
		)[0];
		
		if (!datum){
			throw create(`unable to view ${id} of ${this.structure.name}`, {
				status: 404,
				code: 'BMOOR_CRUD_SERVICE_READ_FILTER',
				context: {
					id
				}
			});
		} else if (this._canAccess){
			if (!(await this._canAccess(datum, ctx))){
				throw create(`now allowed to read instance of ${this.structure.name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_READ',
					context: {}
				});
			}
		}

		return datum;
	}

	async readAll(ctx){
		return massAccess(
			this, 
			await super.read(
				await this.structure.getQuery(
					null,
					{},
					ctx
				),
				ctx
			), 
			ctx
		);
	}

	async readMany(ids, ctx){
		await this.structure.build();

		return massAccess(
			this, 
			await super.read(
				await this.structure.getQuery(
					{[this.structure.properties.key]: ids},
					{},
					ctx
				),
				ctx
			), 
			ctx
		);
	}

	async query(search, ctx){
		await this.structure.build();

		if (this._beforeQuery){
			await this._beforeQuery(search, ctx);
		}

		return massAccess(
			this, 
			await super.read(
				await this.structure.getQuery(
					await this.clean('query', search, ctx), // TODO : transform external => internal?
					{},
					ctx
				),
				ctx
			), 
			ctx
		);
	}

	async update(id, delta, ctx){
		await this.structure.build();

		const tgt = await this.read(id, ctx);

		if (this._beforeUpdate){
			await this._beforeUpdate(id, delta, tgt, ctx, this);
		}

		if (this._canAccess){
			if (!(await this._canAccess(tgt, ctx))){
				throw create(`now allowed to update instance of ${this.structure.name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_UPDATE',
					context: {
						id
					}
				});
			}
		}

		const datum = (
			await super.update(delta, tgt, {
				model: this.structure.name,
				query: {
					[this.structure.properties.key]: id
				}
			}, ctx)
		)[0];

		if (this._afterUpdate){
			await this._afterUpdate(datum, tgt, ctx, this);
		}

		if (ctx){
			ctx.addChange(
				this.structure.name, 
				'update', 
				id, 
				tgt, 
				datum
			);
		}

		return datum;
	}

	/**
	 * Delete will only run off ids.  If you want to do a mass delete, you need to run a query
	 * and then interate over that.  It simplifies the logic, but does make mass deletion an
	 * issue.  I'm ok with that for now.
	 **/
	async delete(id, ctx){
		await this.structure.build();

		const datum = await this.read(id, ctx);

		if (this._beforeDelete){
			await this._beforeDelete(id, datum, ctx, this);
		}

		if (this._canAccess){
			if (!(await this._canAccess(datum, ctx))){
				throw create(`now allowed to update instance of ${this.structure.name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_DELETE',
					context: {
						id
					}
				});
			}
		}

		await super.delete({
			model: this.structure.name,
			query: {
				[this.structure.properties.key]: id
			}
		}, ctx);

		if (this._afterDelete){
			await this._afterDelete(datum, ctx, this);
		}

		if (ctx){
			ctx.addChange(
				this.structure.name, 
				'delete', 
				id, 
				datum, 
				null
			);
		}

		return datum; // datum will have had onRead run against it
	}
}

module.exports = {
	Crud
};
