
const {del} = require('bmoor/src/core.js');

const {hook} = require('./hook.js');

function clearFactory(field, permission){
	return async function(datum, ctx){
		const has = await ctx.hasPermission(permission);

		if (!has){
			del(datum, field);
		}
	};
}

class Forge {
	constructor(nexus, messageBus){
		this.nexus = nexus;
		this.messageBus = messageBus;
	}

	async configure(ref){
		const service = await this.nexus.loadService(ref);

		await hook(service, {
			afterCreate: (datum, ctx) => {
				return this.messageBus.triggerEvent(ref, 'create', datum, ctx);
			},
			afterUpdate: (datum, was, ctx) => {
				return this.messageBus.triggerEvent(ref, 'update', datum, ctx, was);
			},
			afterDelete: (datum, ctx) => {
				return this.messageBus.triggerEvent(ref, 'delete', datum, ctx);
			}
		});

		return service;
	}

	/*
	[{
		model:
		action:
		callback: function(service, )	
	}]
	*/
	async subscribe(ref, subscriptions){
		const service = await this.nexus.loadService(ref);

		return Promise.all(
			subscriptions.map(settings => {
				return this.messageBus.addListener(
					settings.model,
					settings.action,
					(...args) => settings.callback(service, ...args)
				);
			})
		);
	}

	// TODO: validation?

	async secure(ref){
		const service = await this.nexus.loadService(ref);
		const fields = service.model.settings.fields;

		const beforeCreate = [];
		const beforeQuery = [];
		const beforeUpdate = [];

		for (let [field, info] of Object.entries(fields)) {
			if (typeof(info.create) === 'string'){
				beforeCreate.push(clearFactory(field, info.create));
			}

			if (typeof(info.query) === 'string'){
				beforeQuery.push(clearFactory(field, info.query));
			}

			if (typeof(info.update) === 'string'){
				beforeUpdate.push(clearFactory(field, info.update));
			}
		}

		await hook(service, {
			beforeCreate: beforeCreate.length ?
				(datum, ctx) => Promise.all(
					beforeCreate.map(fn => fn(datum, ctx))
				) : null,
			beforeQuery: beforeQuery.length ?
				async function(query, ctx){
					const requested = Object.keys(query);

					const res = await Promise.all(
						beforeQuery.map(fn => fn(query, ctx))
					);

					if (requested.length !== Object.keys(query).length){
						throw new Error('unable to query all properties requested');
					}

					return res;
				} : null,
			beforeUpdate: beforeUpdate.length ?
				(delta, tgt, ctx) => Promise.all(
					beforeUpdate.map(fn => fn(delta, ctx))
				) : null
		});

		return service;
	}
}

module.exports = {
	Forge
};
