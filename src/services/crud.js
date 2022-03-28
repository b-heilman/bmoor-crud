const {create} = require('bmoor/src/lib/error.js');

const {View} = require('./view.js');
const {config: structureConfig} = require('../schema/structure.js');
const {methods} = require('../schema/executable/statement.js');

class Crud extends View {
	async configure(settings = {}) {
		super.configure(settings);

		this.source = await this.structure.nexus.loadSource(
			this.structure.incomingSettings.source
		);
	}

	decorate(decoration) {
		Object.assign(this, decoration);
	}

	async _create(datum, ctx, settings = {}) {
		// this needs to be based on external representation, so if I ever start
		// to accept custom forms, I need to remap
		const errors = await this.validate(
			datum,
			structureConfig.get('writeModes.create'),
			ctx
		);

		if (errors.length) {
			throw create(`create validation failed for ${this.structure.name}`, {
				status: 400,
				code: 'BMOOR_CRUD_SERVICE_VALIDATE_CREATE',
				context: {
					errors
				}
			});
		}

		return this.execute(
			await this.structure.getExecutable(
				methods.create,
				{
					payload: this.actions.deflateCreate(datum, ctx)
				},
				ctx,
				settings
			),
			ctx,
			settings
		);
	}

	async create(proto, ctx, settings = {}) {
		const name = this.structure.name;
		const hooks = this.hooks;
		const security = this.security;

		if (!ctx) {
			throw create(`missing ctx in create of ${name}`, {
				status: 500,
				code: 'BMOOR_CRUD_SERVICE_CREATE_CTX',
				context: {}
			});
		}

		if (hooks.beforeCreate) {
			await hooks.beforeCreate(proto, ctx, this);
		}

		if (security.canCreate) {
			if (!(await security.canCreate(proto, ctx))) {
				throw create(`now allowed to create instance of ${name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_CREATE',
					context: {}
				});
			}
		}

		const datum = (await this._create(proto, ctx, settings))[0];

		const id = this.structure.getKey(datum);
		if (hooks.afterCreate) {
			await hooks.afterCreate(id, datum, ctx, this);
		}

		ctx.sessionCache.set('crud:' + name, id, datum);

		ctx.addChange(name, 'create', id, null, datum);

		return datum;
	}

	async query(schema, ctx, settings = {}) {
		const name = this.structure.name;
		if (!ctx) {
			throw create(`missing ctx in read of ${name}`, {
				status: 500,
				code: 'BMOOR_CRUD_SERVICE_QUERY_CTX',
				context: schema
			});
		}

		const hooks = this.hooks;

		if (hooks.beforeRead) {
			await hooks.beforeRead(null, ctx, this);
		}

		const res = await super.query(
			await this.structure.getQuery(schema, ctx, settings),
			ctx,
			settings
		);

		const security = this.security;

		let rtn = null;
		if (security.canRead) {
			const originLength = res.length;

			rtn = (
				await Promise.all(
					res.map(async (datum) =>
						(await security.canRead(datum, ctx)) ? datum : null
					)
				)
			).filter((v) => !!v);

			// if we filtered out everything via canRead, use a special failure
			if (originLength && !rtn.length) {
				throw create(`now allowed to read instance of ${name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_READ',
					context: {}
				});
			}
		} else {
			rtn = res;
		}

		rtn.map((datum) =>
			ctx.sessionCache.set(
				'crud:' + this.structure.name,
				this.structure.getKey(datum),
				datum
			)
		);

		return rtn;
	}

	async read(id, ctx, settings = {}) {
		const name = this.structure.name;
		const hooks = this.hooks;
		const cache = !settings.noCache;

		if (cache && ctx.sessionCache.has('crud:' + name, id)) {
			return ctx.sessionCache.get('crud:' + name, id);
		}

		if (hooks.beforeRead) {
			await hooks.beforeRead(null, ctx, this);
		}

		const datum = (
			await this.query(
				{
					params: {
						[this.structure.settings.key]: id
					}
				},
				ctx,
				settings
			)
		)[0];

		if (!datum) {
			throw create(`unable to view ${id} of ${name}`, {
				status: 404,
				code: 'BMOOR_CRUD_SERVICE_READ_FILTER',
				context: {
					id
				}
			});
		}

		return datum;
	}

	async readAll(ctx, settings = {}) {
		const hooks = this.hooks;

		if (hooks.beforeRead) {
			await hooks.beforeRead(null, ctx, this);
		}

		return this.query({}, ctx, settings);
	}

	async readMany(ids, ctx, settings = {}) {
		const hooks = this.hooks;

		if (hooks.beforeRead) {
			await hooks.beforeRead(null, ctx, this);
		}

		return this.query(
			{
				params: {
					[this.structure.settings.key]: ids
				}
			},
			ctx,
			settings
		);
	}

	async _update(delta, tgt, params, ctx, settings = {}) {
		const errors = await this.validate(
			delta, // this will be in external structure
			structureConfig.get('writeModes.update'),
			ctx
		);

		if (errors.length) {
			throw create(`update validation failed for ${this.structure.name}`, {
				status: 400,
				code: 'BMOOR_CRUD_SERVICE_VALIDATE_UPDATE',
				context: {
					errors
				}
			});
		}

		return this.execute(
			await this.structure.getExecutable(
				methods.update,
				{
					params,
					payload: this.actions.deflateUpdate(delta, ctx)
				},
				ctx,
				settings
			),
			ctx,
			settings
		);
	}

	async update(id, delta, ctx, settings = {}) {
		const name = this.structure.name;
		const hooks = this.hooks;
		const security = this.security;

		const tgt = await this.read(id, ctx /*, settings*/); // no settings, no custom fields

		if (security.canUpdate) {
			if (!(await security.canUpdate(tgt, ctx))) {
				throw create(`now allowed to update instance of ${name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_UPDATE',
					context: {
						id
					}
				});
			}
		}

		// if I want to allow custom structures for update, and I'm not sure
		// I want to, I need to allow for remapping the delta here

		if (hooks.beforeUpdate) {
			await hooks.beforeUpdate(tgt, ctx, this, delta);
		}

		const datum = (
			await this._update(
				delta,
				tgt,
				{
					[this.structure.settings.key]: id
				},
				ctx,
				settings
			)
		)[0];

		if (hooks.afterUpdate) {
			await hooks.afterUpdate(id, datum, ctx, this);
		}

		ctx.sessionCache.set('crud:' + name, id, datum);

		ctx.addChange(name, 'update', id, tgt, datum);

		return datum;
	}

	async _delete(params, ctx, settings = {}) {
		return this.execute(
			await this.structure.getExecutable(
				methods.delete,
				{
					params
				},
				ctx,
				settings
			),
			ctx,
			settings
		);
	}

	/**
	 * Delete will only run off ids.  If you want to do a mass delete, you need to run a query
	 * and then interate over that.  It simplifies the logic, but does make mass deletion an
	 * issue.  I'm ok with that for now.
	 **/
	async delete(id, ctx, settings = {}) {
		const name = this.structure.name;
		const hooks = this.hooks;
		const security = this.security;

		const datum = await this.read(id, ctx, settings); // settings is allowed here

		if (security.canDelete) {
			if (!(await security.canDelete(datum, ctx))) {
				throw create(`now allowed to update instance of ${name}`, {
					status: 403,
					code: 'BMOOR_CRUD_SERVICE_CAN_DELETE',
					context: {
						id
					}
				});
			}
		}

		if (hooks.beforeDelete) {
			await hooks.beforeDelete(id, datum, ctx, this);
		}

		await this._delete(
			{
				[this.structure.settings.key]: id
			},
			ctx,
			settings
		);

		if (hooks.afterDelete) {
			await hooks.afterDelete(datum, ctx, this);
		}

		ctx.sessionCache.set('crud:' + name, id, datum);

		ctx.addChange(name, 'delete', id, datum, null);

		return datum; // datum will have had onRead run against it
	}

	// TODO: I can't use a clean here, I need to write a copy only
	async discoverDatum(query, ctx) {
		let key = this.structure.getKey(query);

		if (key) {
			// if you make key === 0, you're a horrible person
			return await this.read(key, ctx);
		} else {
			if (this.structure.hasIndex()) {
				const res = await this.query(this.actions.cleanForIndex(query), ctx);

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
