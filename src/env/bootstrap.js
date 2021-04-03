
// used to install a nexus and forge from fs
const {Config} = require('bmoor/src/lib/config.js');

const {Bus} = require('../server/bus.js');
const {Forge} = require('./forge.js');
const {Nexus} = require('./nexus.js');
const {Gateway} =  require('./gateway.js');

const {Model} = require('../schema/model.js');
const {Service} = require('../actors/service.js');
const {Composite} = require('../schema/composite.js');
const {Document} = require('../actors/document.js');
const {Guard} = require('../controllers/guard.js');
const {Action} = require('../controllers/action.js');
const {Utility} = require('../controllers/utility.js');
const {Synthetic} = require('../controllers/synthetic.js');

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
		service: Service,
		composite: Composite,
		document: Document,
		guard: Guard,
		action: Action,
		utility: Utility,
		synthetic: Synthetic
	}
});

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
		this.crud = await this.installCrud();
		this.controllers = await this.installControllers();
	}

	toJSON(){
		return {
			$schema: 'bmoor-crud:bootstrap',
			crud: this.crud,
			controllers: this.controllers
		};
	}
}

module.exports = {
	config,
	Bootstrap
};
