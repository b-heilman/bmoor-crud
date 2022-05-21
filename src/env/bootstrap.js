// used to install a nexus and forge from fs
const {Config} = require('bmoor/src/lib/config.js');

const {Bus} = require('../server/bus.js');
const {Forge} = require('./forge.js');
const {Nexus, config: nexusConfig} = require('./nexus.js');
const {Gateway} = require('./gateway.js');

const {Router} = require('../server/router.js');

const loader = require('../server/loader.js');

const directories = new Config({
	model: '/models',
	decorator: '/decorators',
	hook: '/hooks',
	effect: '/effects',
	composite: '/composites',
	guard: '/guards',
	action: '/actions',
	utility: '/utilities',
	document: '/documents'
});

const routes = new Config({
	root: '/bmoor',
	guard: '/crud',
	action: '/action',
	utility: '/utility',
	synthetic: '/synthetic'
});

const config = new Config(
	{},
	{
		nexus: nexusConfig,
		connectors: new Config({}),
		sources: new Config({}),
		directories,
		routes
	}
);

function assignControllers(guard, controllers) {
	guard.addRouters(controllers.map((controller) => controller.getRouter()));

	return guard;
}

function toRoutes(crudRouter) {
	const routes = [];

	crudRouter.getRouters().forEach((subRouter) => {
		const sub = toRoutes(subRouter);

		sub.forEach((s) => {
			s.path = crudRouter.path + s.path;

			routes.push(s);
		});
	});

	crudRouter.getRoutes().forEach((route) => {
		routes.push({
			path: crudRouter.path + route.path,
			method: route.method
		});
	});

	return routes;
}

class Bootstrap {
	constructor(cfg = config) {
		this.bus = new Bus();
		this.config = cfg;
		this.nexus = new Nexus(cfg.getSub('nexus'));
		this.forge = new Forge(this.nexus, this.bus);
		this.gateway = new Gateway(this.nexus);
	}

	async load(type, directories) {
		const path = directories.get(type);

		if (path) {
			return loader.loadFiles(path);
		} else {
			return [];
		}
	}

	async loadCrud(directories, settings) {
		const connectors = this.config.getSub('connectors');
		await Promise.all(
			connectors.keys().map(async (name) => {
				return this.nexus.setConnector(name, connectors.get(name));
			})
		);

		const sources = this.config.getSub('sources');
		await Promise.all(
			sources.keys().map(async (name) => {
				return this.nexus.configureSource(name, sources.get(name));
			})
		);

		const [models, composites, decorators, hooks, security, effects] =
			await Promise.all([
				this.load('models', directories),
				this.load('composites', directories),
				this.load('decorators', directories),
				this.load('hooks', directories),
				this.load('security', directories),
				this.load('effects', directories)
			]);

		return {
			cruds: (settings.cruds || []).concat(models),
			documents: (settings.documents || []).concat(composites),
			decorators: (settings.decorators || []).concat(decorators),
			hooks: (settings.hooks || []).concat(hooks),
			security: (settings.security || []).concat(security),
			effects: (settings.effects || []).concat(effects)
		};
	}

	async installCrud(settings) {
		return this.forge.install(
			await this.loadCrud(this.config.getSub('directories'), settings)
		);
	}

	async loadControllers(directories, settings) {
		const [guards, synthetics, actions, utilities] = await Promise.all([
			this.load('guards', directories),
			this.load('synthetics', directories),
			this.load('actions', directories),
			this.load('utilities', directories)
		]);

		return {
			guards: (settings.guards || []).concat(guards),
			synthetics: (settings.synthetics || []).concat(synthetics),
			actions: (settings.actions || []).concat(actions),
			utilities: (settings.utilities || []).concat(utilities)
		};
	}

	async installControllers(settings) {
		return this.gateway.install(
			await this.loadControllers(this.config.getSub('directories'), settings)
		);
	}

	async install(settings = {}) {
		this.crud = await this.installCrud(settings);
		this.controllers = await this.installControllers(settings);

		const {guards, actions, utilities, synthetics} = this.controllers;

		const routes = this.config.getSub('routes');
		const root = new Router(routes.get('root'));

		const guard = assignControllers(
			new Router(routes.get('guard')), 
			guards
		);
		const action = assignControllers(
			new Router(routes.get('action')), 
			actions
		);
		const utility = assignControllers(
			new Router(routes.get('utility')),
			utilities
		);
		const synthetic = assignControllers(
			new Router(routes.get('synthetic')),
			synthetics
		);

		root.addRouters([guard, action, utility, synthetic]);

		this.router = root;
	}

	toRoutes() {
		return toRoutes(this.router);
	}

	toJSON() {
		return {
			$schema: 'bmoor-crud:bootstrap',
			crud: this.crud,
			controllers: this.controllers,
			router: this.router
		};
	}
}

module.exports = {
	config,
	Bootstrap
};
