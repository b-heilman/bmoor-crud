
const {hook} = require('../services/hook.js');
const loader = require('../server/loader.js');

// this is our building object, it produces all the little things running in the system
class Forge {
	constructor(nexus, messageBus){
		this.nexus = nexus;
		this.messageBus = messageBus;
	}

	async load(type, directories){
		const path = directories.get(type);

		if (path){
			return loader.loadFiles(path);
		} else {
			return [];
		}
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

	async loadCruds(directories){
		return this.load('model', directories);
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

	async loadDocuments(directories){
		return this.load('composite', directories);
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

	// TODO: I want decorators, effects, and security 
	//   to be able to be installed against a crud or document.
	//   I also stand alone decorators which will become services 
	async loadDecorators(directories){
		return this.load('decorator', directories);
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

	async loadHooks(directories){
		return this.load('hook', directories);
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

	async loadSecurity(directories){
		return this.load('security', directories);
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

	async loadEffects(directories){
		return this.load('security', directories);
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

	async install(directories, preload){
		if (!directories){
			throw new Error('no directories supplied');
		}

		const [services, docs] = 
		await Promise.all([
			this.installCruds(
				(preload&&preload.get('cruds')||[])
				.concat(await this.loadCruds(directories))
			),
			this.installDocuments(
				(preload&&preload.get('documents')||[])
				.concat(await this.loadDocuments(directories))
			),
			this.installDecorators(
				(preload&&preload.get('decorators')||[])
				.concat(await this.loadDecorators(directories))
			),
			this.installHooks(
				(preload&&preload.get('hooks')||[])
				.concat(await this.loadHooks(directories))
			),
			this.installSecurity(
				(preload&&preload.get('security')||[])
				.concat(await this.loadSecurity(directories))
			),
			this.installEffects(
				(preload&&preload.get('effects')||[])
				.concat(await this.loadEffects(directories))
			)
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
