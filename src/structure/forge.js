
const {hook} = require('../hook.js');
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

	async install(config){
		const connectors = config.get('connectors');

		const [models, decorators, hooks, actions, composites] = await Promise.all([
			loader.getFiles(config.get('model.directory')),
			loader.getFiles(config.get('decorator.directory')),
			loader.getFiles(config.get('hook.directory')),
			loader.getFiles(config.get('action.directory')),
			loader.getFiles(config.get('composite.directory'))
		]);

		// install the services, they should be fully hydrated at this point
		await Promise.all(models.map(
			async (file) => {
				const settings = await loader.getSettings(file.path);

				await this.nexus.setModel(
					file.name,
					settings
				);

				await this.nexus.installService(
					file.name,
					connectors[settings.connector](settings.connectorSettings)
				);

				return this.configureService(file.name, settings);
			}
		));

		await Promise.all([
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

			Promise.all(actions.map(
				async (file) => this.subscribe(
					file.name,
					await loader.getSettings(file.path)
				)
			)),

			Promise.all(composites.map(
				async (file) => {
					const settings = await loader.getSettings(file.path);

					// so for now, all composites have to come from the same
					// connector, but I want to change that in the future
					return this.nexus.installComposite(
						file.name,
						connectors[settings.connector](settings.connectorSettings),
						settings
					);
				}
			))
		]);
	}
}

module.exports = {
	Forge
};
