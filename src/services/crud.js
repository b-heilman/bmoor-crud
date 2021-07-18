
const {create} = require('bmoor/src/lib/error.js');

const {View, runMap} = require('./view.js');
const {config: structureConfig} = require('../schema/structure.js');

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
			structureConfig.get('writeModes.create'), 
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
		const name = this.structure.name;
		const hooks = this.hooks;
		const security = this.security;

		if (!ctx){
			throw create(`missing ctx in create of ${name}`, {
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
				throw create(`now allowed to create instance of ${name}`, {
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
					model: name
				}, 
				ctx
			)
		)[0];

		const key = this.structure.getKey(datum);
		if (hooks.afterCreate){
			await hooks.afterCreate(key, datum, ctx, this);
		}

		if (ctx.cache){
			ctx.cache.set(name, key, datum);
		}

		if (ctx.addChange){
			ctx.addChange(
				name,
				'create', 
				key, 
				null, 
				datum
			);
		}

		return datum;
	}

	async read(id, ctx){
		const name = this.structure.name;
		const hooks = this.hooks;
		const security = this.security;

		await this.structure.build();

		if (hooks.beforeRead){
			await hooks.beforeRead(null, ctx, this);
		}

		if (!ctx){
			throw create(`missing ctx in read of ${name}`, {
				status: 500,
				code: 'BMOOR_CRUD_SERVICE_READ_CTX',
				context: {
					id
				}
			});
		}

		let datum = null;

		// If the current context has a cache, check it.  I am doing it this way
		// because the context can dictate the cache, which allows you to do per
		// call caches and system wide caches.
		if (ctx.cache && await ctx.cache.has(name, id)){
			datum = await ctx.cache.get(name, id);
		} else {
			const res = await super.read(
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

			datum = res[0];

			if (ctx.cache){
				ctx.cache.set(name, id, datum);
			}
		}
		
		if (!datum){
			throw create(`unable to view ${id} of ${name}`, {
				status: 404,
				code: 'BMOOR_CRUD_SERVICE_READ_FILTER',
				context: {
					id
				}
			});
		} else if (security.canRead){
			if (!(await security.canRead(datum, ctx))){
				throw create(`now allowed to read instance of ${name}`, {
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

		const rtn = await massAccess(
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

		if (ctx.cache){
			rtn.map(
				datum => ctx.cache.set(
					this.structure.name,
					this.structure.getKey(datum), 
					datum
				)
			);
		}

		return rtn;
	}

	async _update(delta, tgt, stmt, ctx){
		const cleaned = await this.clean('update', delta, ctx);

		const payload = this.structure.actions.update ?
			this.structure.actions.update(cleaned, tgt, ctx) : cleaned;

		const errors = await this.validate(
			payload,
			structureConfig.get('writeModes.update'),
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
		const name = this.structure.name;
		const hooks = this.hooks;
		const security = this.security;

		await this.structure.build();

		const tgt = await this.read(id, ctx);

		if (security.canUpdate){
			if (!(await security.canUpdate(tgt, ctx))){
				throw create(`now allowed to update instance of ${name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_UPDATE',
					context: {
						id
					}
				});
			}
		}

		if (hooks.beforeUpdate){
			await hooks.beforeUpdate(tgt, ctx, this, delta);
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
			await hooks.afterUpdate(id, datum, ctx, this);
		}

		if (ctx.cache){
			ctx.cache.set(name, id, datum);
		}

		if (ctx.addChange){
			ctx.addChange(
				name, 
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
		const name = this.structure.name;
		const hooks = this.hooks;
		const security = this.security;

		await this.structure.build();

		const datum = await this.read(id, ctx);

		if (security.canDelete){
			if (!(await security.canDelete(datum, ctx))){
				throw create(`now allowed to update instance of ${name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_DELETE',
					context: {
						id
					}
				});
			}
		}

		if (hooks.beforeDelete){
			await hooks.beforeDelete(id, datum, ctx, this);
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
				name, 
				'delete', 
				id, 
				datum, 
				null
			);
		}

		return datum; // datum will have had onRead run against it
	}

	async discoverDatum(query, ctx){
		let key = this.structure.getKey(query);
		
		if (key){
			// if you make key === 0, you're a horrible person
			return await this.read(key, ctx);
		} else {
			if (this.structure.hasIndex()){
				const res = await this.query(
					this.structure.clean('index', query), 
					ctx
				);

				return res[0];
			} else {
				return null;
			}
		}
	}
}

module.exports = {
	Crud
};
