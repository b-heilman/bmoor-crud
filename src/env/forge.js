
const {hook} = require('../actors/hook.js');
const loader = require('../server/loader.js');

async function load(type, directories, stubs = null){
	if (stubs){
		const stub = stubs.get(type);

		if (stub){
			return stub;
		}
	}

	console.log('->', type);
	return loader.loadFiles(directories.get(type));
}

// this is our building object, it produces all the little things running in the system
class Forge {
	constructor(nexus, messageBus){
		this.nexus = nexus;
		this.messageBus = messageBus;
	}

	async configureService(ref, settings={}){
		const service = await this.nexus.loadService(ref);

		await hook(service, {
			afterCreate: (datum, ctx) => {
				return this.messageBus.triggerEvent(ref, 'create', [null, datum, ctx]);
			},
			afterUpdate: (datum, was, ctx) => {
				return this.messageBus.triggerEvent(ref, 'update', [was, datum, ctx]);
			},
			afterDelete: (datum, ctx) => {
				return this.messageBus.triggerEvent(ref, 'delete', [datum, null, ctx]);
			}
		});

		const security = settings.security;
		if (security){
			await this.nexus.applySecurity(ref, security);
		}

		return service;
	}

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

	async installServices(connectors, directories, stubs){
		return Promise.all(
			(await load('model', directories, stubs))
			.map(async (file) => {
				const settings = file.settings;

				await this.nexus.setModel(
					file.name,
					settings
				);

				const service = await this.nexus.installService(
					file.name,
					connectors.get(settings.connector)(settings.connectorSettings)
				);

				await this.configureService(file.name, settings);

				return service;
			})
		);
	}

	async installDocuments(connectors, directories, stubs){
		return Promise.all(
			(await load('composite', directories, stubs))
			.map(async (file) => {
				const settings = file.settings;

				await this.nexus.setModel(
					file.name,
					settings
				);

				const doc = await this.nexus.installDocument(
					file.name,
					connectors.get(settings.connector)(settings.connectorSettings)
				);

				return doc;
			})
		);
	}

	async installDecorators(directories, stubs){
		return Promise.all(
			(await load('decorator', directories, stubs))
			.map(async (file) => this.nexus.applyDecorator(file.name, file.settings))
		);
	}

	async installHooks(directories, stubs){
		return Promise.all(
			(await load('hook', directories, stubs))
			.map(async (file) => this.nexus.applyHook(file.name, file.settings))
		);
	}

	async installEffects(directories, stubs){
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
			this.installServices(connectors, directories, stubs),
			this.installDocuments(connectors, directories, stubs),
			this.installDecorators(directories, stubs),
			this.installHooks(directories, stubs),
			this.installEffects(directories, stubs)
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
