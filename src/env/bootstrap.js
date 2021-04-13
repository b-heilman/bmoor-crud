
// used to install a nexus and forge from fs
const {Config} = require('bmoor/src/lib/config.js');

const {Bus} = require('../server/bus.js');
const {Forge} = require('./forge.js');
const {Nexus} = require('./nexus.js');
const {Gateway} =  require('./gateway.js');

const {Model} = require('../schema/model.js');
const {Crud} = require('../services/crud.js');
const {Composite} = require('../schema/composite.js');
const {Document} = require('../services/document.js');
const {Guard} = require('../controllers/guard.js');
const {Action} = require('../controllers/action.js');
const {Utility} = require('../controllers/utility.js');
const {Synthetic} = require('../controllers/synthetic.js');
const {Router} = require('../server/router.js');

const config = new Config({
	connectors: {},
	stubs: {
		model: null
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
	constructors: {
		model: Model,
		crud: Crud,
		composite: Composite,
		document: Document,
		guard: Guard,
		action: Action,
		utility: Utility,
		synthetic: Synthetic
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
		this.nexus = new Nexus(cfg.sub('constructors'));
		this.forge = new Forge(this.nexus, this.bus);
		this.gateway = new Gateway(this.nexus);
	}

	async installCrud(){
		return this.forge.install(
			this.config.sub('connectors'), 
			this.config.sub('directories'),
			this.config.sub('stubs')
		);
	}

	async installControllers(){
		return this.gateway.install(
			this.config.sub('directories'),
			this.config.sub('stubs')
		);
	}

	async install(){
		const routes = this.config.sub('routes');

		this.crud = await this.installCrud();
		this.controllers = await this.installControllers();

		const {guards, actions, utilities, synthetics} = this.controllers;
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
