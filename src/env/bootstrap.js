
// used to install a nexus and forge from fs

const {Bus} = require('../server/bus.js');
const {Forge} = require('./forge.js');
const {Nexus, config: nexusConfig} = require('./nexus.js');
const {Gateway} =  require('./gateway.js');

const {Guard} = require('../controllers/guard.js');
const {Action} = require('../controllers/action.js');
const {Utility} = require('../controllers/utility.js');
const {Synthetic} = require('../controllers/synthetic.js');
const {Router} = require('../server/router.js');

const constructors = nexusConfig.sub('constructors');
constructors.set('guard', Guard);
constructors.set('action', Action);
constructors.set('utility', Utility);
constructors.set('synthetic', Synthetic);

const config = nexusConfig.extend({
	constructors: {
		'guard': Guard,
		'action': Action,
		'utility': Utility,
		'synthetic': Synthetic
	},
	directories: {
		model: '/models',
		decorator: '/decorators',
		hook: '/hooks',
		effect: '/effects',
		composite: '/composites',
		guard: '/guards',
		action: '/actions',
		utility: '/utilities',
		document: '/documents'
	},
	routes: {
		root: '/bmoor',
		guard: '/crud',
		action: '/action',
		utility: '/utility',
		synthetic: '/synthetic'
	}
});

function assignControllers(guard, controllers){
	guard.addRouters(controllers.map(controller => controller.getRouter()));

	return guard;
}

function toRoutes(crudRouter){
	const routes = [];

	crudRouter.getRouters().forEach(subRouter => {
		const sub = toRoutes(subRouter);

		sub.forEach(s => {
			s.path = crudRouter.path+s.path;

			routes.push(s);
		});
	});

	crudRouter.getRoutes().forEach(route => {
		routes.push({
			path: crudRouter.path+route.path,
			method: route.method
		});
	});

	return routes;
}

class Bootstrap {
	constructor(cfg = config){
		this.bus = new Bus();
		this.config = cfg;
		this.nexus = new Nexus(cfg.sub('constructors'), cfg.sub('connectors'));
		this.forge = new Forge(this.nexus, this.bus);
		this.gateway = new Gateway(this.nexus);
	}

	async installCrud(preload){
		return this.forge.install(this.config.sub('directories'), preload);
	}

	async installControllers(preload){
		return this.gateway.install(this.config.sub('directories'), preload);
	}

	async install(preload){
		this.crud = await this.installCrud(preload);
		this.controllers = await this.installControllers(preload);

		const {guards, actions, utilities, synthetics} = this.controllers;

		const routes = this.config.sub('routes');
		const root = new Router(routes.get('root'));

		const guard = assignControllers(new Router(routes.get('guard')), guards);
		const action = assignControllers(new Router(routes.get('action')), actions);
		const utility = assignControllers(new Router(routes.get('utility')), utilities);
		const synthetic = assignControllers(new Router(routes.get('synthetic')), synthetics);

		root.addRouters([guard, action, utility, synthetic]);

		this.router = root;
	}

	toRoutes(){
		return toRoutes(this.router);
	}

	toJSON(){
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
