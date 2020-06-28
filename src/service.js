
const {create} = require('bmoor/src/lib/error.js');

const {View} = require('./view.js');

class Service extends View {
	constructor(model, connector, settings = {}){
		super(model, connector, settings);
	}

	decorate(decoration){
		Object.assign(this, decoration);
	}

	async create(proto, ctx){
		if (this._beforeCreate){
			await this._beforeCreate(proto, ctx, this);
		}

		const datum = (
			await super.create(
				proto, 
				{
					model: this.schema.name
				}, 
				ctx
			)
		)[0];

		if (this._afterCreate){
			await this._afterCreate(datum, ctx, this);
		}

		if (ctx){
			ctx.addChange(this.schema.name, 'create', null, datum);
		}

		return datum;
	}

	async read(id, ctx){
		if (!ctx){
			throw create(`missing ctx in read of ${this.schema.name}`, {
				status: 500,
				code: 'BMOOR_CRUD_SERVICE_READ_CTX',
				context: {
					id
				}
			});
		}

		await this.schema.build();

		const datum = (
			await super.read(
				await this.schema.getQuery(
					{[this.schema.properties.key]: id},
					{},
					ctx
				),
				ctx
			)
		)[0];
		
		if (!datum){
			throw create(`unable to view ${id} of ${this.schema.name}`, {
				status: 404,
				code: 'BMOOR_CRUD_SERVICE_READ_FILTER',
				context: {
					id
				}
			});
		}

		return datum;
	}

	async readAll(ctx){
		return super.read(
			await this.schema.getQuery(
				null,
				{},
				ctx
			),
			ctx
		);
	}

	async readMany(ids, ctx){
		await this.schema.build();

		return super.read(
			await this.schema.getQuery(
				{[this.schema.properties.key]: ids},
				{},
				ctx
			),
			ctx
		);
	}

	async query(search, ctx){
		await this.schema.build();

		if (this._beforeQuery){
			await this._beforeQuery(search, ctx);
		}

		return super.read(
			await this.schema.getQuery(
				await this.clean('query', search, ctx), // TODO : transform external => internal?
				{},
				ctx
			),
			ctx
		);
	}

	async update(id, delta, ctx){
		await this.schema.build();

		const tgt = await this.read(id, ctx);

		if (this._beforeUpdate){
			await this._beforeUpdate(id, delta, tgt, ctx, this);
		}

		const datum = (
			await super.update(delta, tgt, {
				model: this.schema.name,
				query: {
					[this.schema.properties.key]: id
				}
			}, ctx)
		)[0];

		if (this._afterUpdate){
			await this._afterUpdate(datum, tgt, ctx, this);
		}

		if (ctx){
			ctx.addChange(this.schema.name, 'update', tgt, datum);
		}

		return datum;
	}

	/**
	 * Delete will only run off ids.  If you want to do a mass delete, you need to run a query
	 * and then interate over that.  It simplifies the logic, but does make mass deletion an
	 * issue.  I'm ok with that for now.
	 **/
	async delete(id, ctx){
		await this.schema.build();

		const datum = await this.read(id, ctx);

		if (this._beforeDelete){
			await this._beforeDelete(id, datum, ctx, this);
		}

		await super.delete({
			model: this.schema.name,
			query: {
				[this.schema.properties.key]: id
			}
		}, ctx);

		if (this._afterDelete){
			await this._afterDelete(datum, ctx, this);
		}

		if (ctx){
			ctx.addChange(this.schema.name, 'delete', datum, null);
		}

		return datum; // datum will have had onRead run against it
	}
}

module.exports = {
	Service
};
