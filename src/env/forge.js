
const {hook} = require('../services/hook.js');

// this is our building object, it produces all the little things running in the system
class Forge {
	constructor(nexus, messageBus){
		this.nexus = nexus;
		this.messageBus = messageBus;
	}

	async subscribe(ref, subscriptions){
		const service = await this.nexus.loadCrud(ref);

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

	async installCruds(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				await this.nexus.configureModel(ref, settings);

				const service = await this.nexus.configureCrud(ref, settings);

				hook(service, {
					afterCreate: (datum, ctx) => {
						return this.messageBus.triggerEvent(ref, 'create', [null, datum, ctx]);
					},
					afterUpdate: (datum, ctx, self, was) => {
						return this.messageBus.triggerEvent(ref, 'update', [was, datum, ctx]);
					},
					afterDelete: (datum, ctx) => {
						return this.messageBus.triggerEvent(ref, 'delete', [datum, null, ctx]);
					}
				});

				return service;
			})
		);
	}

	async installDocuments(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				await this.nexus.configureComposite(ref, settings);

				const doc = await this.nexus.configureDocument(ref, settings);

				return doc;
			})
		);
	}

	async installDecorators(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				await this.nexus.configureDecorator(ref, settings);
			})
		);
	}

	async installHooks(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				await this.nexus.configureHook(ref, settings);
			})
		);
	}

	async installSecurity(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				await this.nexus.configureSecurity(ref, settings);
			})
		);
	}

	async installEffects(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				await this.subscribe(ref, settings);
			})
		);
	}

	async install(cfg){
		const [services, docs] = await Promise.all([
			this.installCruds(cfg.get('cruds')||[]),
			this.installDocuments(cfg.get('documents')||[]),
			this.installDecorators(cfg.get('decorators')||[]),
			this.installHooks(cfg.get('hooks')||[]),
			this.installSecurity(cfg.get('security')||[]),
			this.installEffects(cfg.get('effects')||[])
		]);
		
		// install the services, they should be fully hydrated at this point
		return {
			services,
			documents: docs
		};
	}
}

module.exports = {
	Forge
};
