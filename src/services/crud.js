
const {create} = require('bmoor/src/lib/error.js');

const {View} = require('./view.js');

async function massAccess(service, arr, ctx){
	const hooks = service.hooks;

	if (hooks.canRead){
		return (await Promise.all(
			arr.map(
				async (datum) => 
				(await hooks.canRead(datum, ctx)) ? datum : null
			)
		)).filter(v => !!v);
	} else {
		return arr;
	}
}

class Crud extends View {
	
	decorate(decoration){
		Object.assign(this, decoration);
	}

	async create(proto, ctx){
		const hooks = this.hooks;

		if (!ctx){
			throw create(`missing ctx in create of ${this.structure.name}`, {
				status: 500,
				code: 'BMOOR_CRUD_SERVICE_CREATE_CTX',
				context: {}
			});
		}

		if (hooks.beforeCreate){
			await hooks.beforeCreate(proto, ctx, this);
		}

		if (hooks.canCreate){
			if (!(await hooks.canCreate(proto, ctx))){
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

		if (hooks.afterCreate){
			await hooks.afterCreate(datum, ctx, this);
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
		const hooks = this.hooks;

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
				{
					query: await this.structure.getQuery(
						{
							params: {
								[this.structure.settings.key]: id
							}
						},
						ctx
					)
				},
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
		} else if (hooks.canRead){
			if (!(await hooks.canRead(datum, ctx))){
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
				{
					query: await this.structure.getQuery(
						{},
						ctx
					)
				},
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
				{
					query: await this.structure.getQuery(
						{
							params: {
								[this.structure.settings.key]: ids
							}
						},
						ctx
					)
				},
				ctx
			), 
			ctx
		);
	}

	async query(settings, ctx){
		const hooks = this.hooks;

		await this.structure.build();

		if (hooks.beforeQuery){
			await hooks.beforeQuery(settings.params, ctx);
		}

		return massAccess(
			this, 
			await super.read(
				{
					query: await this.structure.getQuery(
						settings,
						ctx
					)
				},
				ctx
			), 
			ctx
		);
	}

	async update(id, delta, ctx){
		const hooks = this.hooks;

		await this.structure.build();

		const tgt = await this.read(id, ctx);

		if (hooks.beforeUpdate){
			await hooks.beforeUpdate(id, delta, tgt, ctx, this);
		}

		if (hooks.canUpdate){
			if (!(await hooks.canUpdate(tgt, ctx))){
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
				query: await this.structure.getQuery(
					{
						params: {
							[this.structure.settings.key]: id
						}
					},
					ctx
				)
			}, ctx)
		)[0];

		if (hooks.afterUpdate){
			await hooks.afterUpdate(datum, tgt, ctx, this);
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
		const hooks = this.hooks;

		await this.structure.build();

		const datum = await this.read(id, ctx);

		if (hooks.beforeDelete){
			await hooks.beforeDelete(id, datum, ctx, this);
		}

		if (hooks.canDelete){
			if (!(await hooks.canDelete(datum, ctx))){
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
			query: await this.structure.getQuery(
				{
					params: {
						[this.structure.settings.key]: id
					}
				},
				ctx
			)
		}, ctx);

		if (hooks.afterDelete){
			await hooks.afterDelete(datum, ctx, this);
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
