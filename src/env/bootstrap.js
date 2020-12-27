
// used to install a nexus and forge from fs
const {Config} = require('bmoor/src/lib/config.js');

const {Bus} = require('../server/bus.js');
const {Forge} = require('./forge.js');
const {Nexus} = require('./nexus.js');

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
	crud: {
		model: 'models/',
		decorator: 'decorators/',
		hook: 'hooks/',
		effect: 'effects/',
		composite: 'composites/'
	},
	server: {
		guard: 'guards/'
	},
	constructors: {
		crud: {
			Model,
			Service,
			Composite,
			Document
		},
		controller: {
			Guard,
			Action,
			Utility,
			Synthetic
		}
	}
});

class Bootstrap {
	constructor(cfg){
		this.bus = new Bus();
		this.config = cfg;
		this.nexus = new Nexus(cfg.sub('constructors.crud'));
		this.forge = new Forge(this.nexus, this.bus);
	}

	async crud(){
		return this.forge.install(
			this.config.sub('connectors'), 
			this.config.sub('crud')
		);
	}

	async server(){
		return this.config.sub('server');
	}

	async boot(){
		await this.crud();

		return this.server();
	}
}

module.exports = {
	config,
	Bootstrap
};
