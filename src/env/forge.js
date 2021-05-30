
const {hook} = require('../services/hook.js');
const loader = require('../server/loader.js');

async function load(type, directories, stubs = null){
	if (stubs){
		const stub = stubs.get(type);

		if (stub){
			return stub;
		}
	}

	return loader.loadFiles(directories.get(type));
}

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

	async configureCruds(connectors, directories, stubs){
		return Promise.all(
			(await load('model', directories, stubs))
			.map(async (file) => {
				const ref = file.name;
				const settings = file.settings;

				await this.nexus.configureModel(ref, settings);

				const service = await this.nexus.configureCrud(
					file.name,
					connectors.get(settings.connector)(settings.connectorSettings),
					settings
				);

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

	async configureDocuments(connectors, directories, stubs){
		return Promise.all(
			(await load('composite', directories, stubs))
			.map(async (file) => {
				const settings = file.settings;

				await this.nexus.configureComposite(
					file.name,
					settings
				);

				const doc = await this.nexus.configureDocument(
					file.name,
					connectors.get(settings.connector)(settings.connectorSettings),
					settings
				);

				return doc;
			})
		);
	}

	async configureDecorators(directories, stubs){
		return Promise.all(
			(await load('decorator', directories, stubs))
			.map(async (file) => this.nexus.configureDecorator(file.name, file.settings))
		);
	}

	async configureHooks(directories, stubs){
		return Promise.all(
			(await load('hook', directories, stubs))
			.map(async (file) => this.nexus.configureHook(file.name, file.settings))
		);
	}

	async configureSecurity(directories, stubs){
		return Promise.all(
			(await load('security', directories, stubs))
			.map(async (file) => this.nexus.configureSecurity(file.name, file.settings))
		);
	}

	async configureEffects(directories, stubs){
		return Promise.all(
			(await load('effect', directories, stubs))
			.map(async (file) => this.subscribe(file.name, file.settings))
		);
	}

	async install(connectors, directories, stubs){
		if (!connectors){
			throw new Error('no connectors supplied');
		}

		if (!directories){
			throw new Error('no directories supplied');
		}

		const [services, docs] = 
		await Promise.all([
			// TODO: documents should inherit their connectors
			this.configureCruds(connectors, directories, stubs),
			this.configureDocuments(connectors, directories, stubs),
			this.configureDecorators(directories, stubs),
			this.configureHooks(directories, stubs),
			this.configureSecurity(directories, stubs),
			this.configureEffects(directories, stubs)
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
