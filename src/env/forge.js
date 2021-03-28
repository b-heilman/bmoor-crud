
const {hook} = require('../actors/hook.js');
const loader = require('../server/loader.js');

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

	async getSettings(directory){
		return Promise.all(
			(await loader.getFiles(directory)).map(
				async (file) => {
					file.settings = await loader.getSettings(file.path);

					return file;
				}
			)
		);
	}

	async installServices(connectors, directories){
		return Promise.all(
			(await this.getSettings(directories.get('model')))
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

	async installDocuments(connectors, directories){
		return Promise.all(
			(await this.getSettings(directories.get('composite')))
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

	async installDecorators(directories){
		return Promise.all(
			(await this.getSettings(directories.get('decorator')))
			.map(async (file) => this.nexus.applyDecorator(file.name, file.settings))
		);
	}

	async installHooks(directories){
		return Promise.all(
			(await this.getSettings(directories.get('hook')))
			.map(async (file) => this.nexus.applyHook(file.name, file.settings))
		);
	}

	async installEffects(directories){
		return Promise.all(
			(await this.getSettings(directories.get('effect')))
			.map(async (file) => this.subscribe(file.name, file.settings))
		);
	}

	async install(connectors, directories){
		if (!connectors){
			throw new Error('no connectors supplied');
		}

		if (!directories){
			throw new Error('no directories supplied');
		}

		const [services, docs] = 
		await Promise.all([
			this.installServices(connectors, directories),
			this.installDocuments(connectors, directories),
			this.installDecorators(directories),
			this.installHooks(directories),
			this.installEffects(directories)
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
