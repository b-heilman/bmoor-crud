
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

	async install(connectors, directories){
		if (!connectors){
			throw new Error('no connectors supplied');
		}

		if (!directories){
			throw new Error('no directories supplied');
		}

		const [models, decorators, hooks, effects, composites] = 
		await Promise.all([
			loader.getFiles(directories.get('model')),
			loader.getFiles(directories.get('decorator')),
			loader.getFiles(directories.get('hook')),
			loader.getFiles(directories.get('effect')),
			loader.getFiles(directories.get('composite'))
		]);

		// install the services, they should be fully hydrated at this point
		const [modelNames, compositeNames] =
		await Promise.all([
			Promise.all(models.map(
				async (file) => {
					const settings = await loader.getSettings(file.path);

					await this.nexus.setModel(
						file.name,
						settings
					);

					await this.nexus.installService(
						file.name,
						connectors.get(settings.connector)(settings.connectorSettings)
					);

					await this.configureService(file.name, settings);

					return file.name;
				}
			)),

			Promise.all(composites.map(
				async (file) => {
					const settings = await loader.getSettings(file.path);

					// so for now, all composites have to come from the same
					// connector, but I want to change that in the future
					await this.nexus.setComposite(
						file.name,
						settings
					);

					await this.nexus.installDocument(
						file.name,
						connectors.get(settings.connector)(settings.connectorSettings),
					);

					return file.name;
				}
			)),

			Promise.all([
				Promise.all(decorators.map(
					async (file) => this.nexus.applyDecorator(
						file.name,
						await loader.getSettings(file.path)
					)
				)),

				Promise.all(hooks.map(
					async (file) => this.nexus.applyHook(
						file.name,
						await loader.getSettings(file.path)
					)
				)),

				Promise.all(effects.map(
					async (file) => this.subscribe(
						file.name,
						await loader.getSettings(file.path)
					)
				))
			])
		]);

		return {
			models: modelNames,
			composites: compositeNames
		};
	}
}

module.exports = {
	Forge
};
