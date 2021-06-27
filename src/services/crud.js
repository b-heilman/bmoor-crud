
const {create} = require('bmoor/src/lib/error.js');

const {View, runMap} = require('./view.js');
const {config} = require('../schema/model.js');

async function massAccess(service, arr, ctx){
	const security = service.security;

	if (security.canRead){
		return (await Promise.all(
			arr.map(
				async (datum) => 
				(await security.canRead(datum, ctx)) ? datum : null
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

	async _create(datum, stmt, ctx){
		const cleaned = await this.clean('create', datum, ctx);
		const payload = this.structure.actions.create ?
			this.structure.actions.create(cleaned, cleaned, ctx) : cleaned;

		const errors = await this.validate(
			payload,
			config.get('writeModes.create'), 
			ctx
		);

		if (errors.length){
			throw create(`create validation failed for ${this.structure.name}`, {
				status: 400,
				code: 'BMOOR_CRUD_SERVICE_VALIDATE_CREATE',
				context: {
					errors
				}
			});
		}

		stmt.method = 'create';
		stmt.payload = this.structure.actions.deflate ?
			this.structure.actions.deflate(payload, ctx) : payload;

		if (this.incomingSettings.deflate){
			stmt.payload = this.incomingSettings.deflate(stmt.payload);
		}

		return runMap(
			await this.structure.execute(stmt, ctx), 
			this, 
			ctx
		);
	}

	async create(proto, ctx){
		const hooks = this.hooks;
		const security = this.security;

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

		if (security.canCreate){
			if (!(await security.canCreate(proto, ctx))){
				throw create(`now allowed to create instance of ${this.structure.name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_CREATE',
					context: {}
				});
			}
		}

		const datum = (
			await this._create(
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

	// TODO: one thing I need to do is start cacheing gets, I can assume if I 
	//   get by name or get by something else, I will reference it by id later,
	//   I should bake that into this layer to improve performance
	async read(id, ctx){
		const hooks = this.hooks;
		const security = this.security;

		await this.structure.build();

		if (hooks.beforeRead){
			await hooks.beforeRead(null, ctx, this);
		}

		if (!ctx){
			throw create(`missing ctx in read of ${this.structure.name}`, {
				status: 500,
				code: 'BMOOR_CRUD_SERVICE_READ_CTX',
				context: {
					id
				}
			});
		}

		const [datum] = await super.read(
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
		);
		
		if (!datum){
			throw create(`unable to view ${id} of ${this.structure.name}`, {
				status: 404,
				code: 'BMOOR_CRUD_SERVICE_READ_FILTER',
				context: {
					id
				}
			});
		} else if (security.canRead){
			if (!(await security.canRead(datum, ctx))){
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
		const hooks = this.hooks;

		await this.structure.build();

		if (hooks.beforeRead){
			await hooks.beforeRead(null, ctx, this);
		}

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
		const hooks = this.hooks;

		await this.structure.build();

		if (hooks.beforeRead){
			await hooks.beforeRead(null, ctx, this);
		}

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

		if (hooks.beforeRead){
			await hooks.beforeRead(null, ctx, this);
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

	async _update(delta, tgt, stmt, ctx){
		const cleaned = await this.clean('update', delta, ctx);

		const payload = this.structure.actions.update ?
			this.structure.actions.update(cleaned, tgt, ctx) : cleaned;

		const errors = await this.validate(
			payload,
			config.get('writeModes.update'),
			ctx
		);

		if (errors.length){
			throw create(`update validation failed for ${this.structure.name}`, {
				status: 400,
				code: 'BMOOR_CRUD_SERVICE_VALIDATE_UPDATE',
				context: {
					errors
				}
			});
		}

		stmt.method = 'update';
		stmt.payload = this.structure.actions.deflate ?
			this.structure.actions.deflate(payload, ctx) : payload;

		return runMap(
			await this.structure.execute(stmt, ctx), 
			this,
			ctx
		);
	}

	async update(id, delta, ctx){
		const hooks = this.hooks;
		const security = this.security;

		await this.structure.build();

		const tgt = await this.read(id, ctx);

		if (hooks.beforeUpdate){
			await hooks.beforeUpdate(tgt, ctx, this, delta);
		}

		if (security.canUpdate){
			if (!(await security.canUpdate(tgt, ctx))){
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
			await this._update(delta, tgt, {
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
			await hooks.afterUpdate(datum, ctx, this);
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

	async _delete(stmt, ctx){
		stmt.method = 'delete';

		return this.structure.execute(stmt, ctx);
	}

	/**
	 * Delete will only run off ids.  If you want to do a mass delete, you need to run a query
	 * and then interate over that.  It simplifies the logic, but does make mass deletion an
	 * issue.  I'm ok with that for now.
	 **/
	async delete(id, ctx){
		const hooks = this.hooks;
		const security = this.security;

		await this.structure.build();

		const datum = await this.read(id, ctx);

		if (hooks.beforeDelete){
			await hooks.beforeDelete(datum, ctx, this);
		}

		if (security.canDelete){
			if (!(await security.canDelete(datum, ctx))){
				throw create(`now allowed to update instance of ${this.structure.name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_DELETE',
					context: {
						id
					}
				});
			}
		}

		await this._delete({
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

	async getChangeType(datum, id = null, ctx = null){
		let delta = datum;

		if (id){
			const target = await this.read(id, ctx);

			if (target){
				delta = this.structure.getFields()
				.reduce(
					(agg, field) => {
						const incomingValue = field.externalGetter(datum);
						const existingValue = field.externalGetter(target);

						if (incomingValue !== existingValue && 
							incomingValue !== undefined){
							field.externalSetter(agg, incomingValue);
						}

						return agg;
					},
					{}
				);
			}
		}

		return this.structure.getChangeType(delta);
	}

	async validate(delta, mode, ctx){
		const security = this.security;

		const errors = this.structure.validate(delta, mode);

		return security.validate ? 
			errors.concat(await security.validate(delta, mode, ctx)) : errors;
	}
}

module.exports = {
	Crud
};
