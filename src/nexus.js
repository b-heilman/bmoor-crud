
const {Config} = require('bmoor/src/lib/config.js');

const {Model} = require('./Model.js');
const {Service} = require('./Service.js');
const {hook} = require('./hook.js');

class Nexus {
	constructor(){
		this.ether = new Config({
			models: {},
			services: {}
		});
	}

	async setModel(ref, settings){
		const path = 'models.'+ref;
		const model = new Model(ref, settings);

		await this.ether.set(path, model);

		return model;
	}

	async loadModel(ref){
		const modelPath = 'models.'+ref;
		
		let model = this.ether.get(modelPath);

		if (!model){
			model = await this.ether.promised(modelPath, model => model);
		}

		return model;
	}

	async installService(ref, connector){
		const model = await this.loadModel(ref);

		const service = new Service(model, connector);

		await this.ether.set('services.'+ref, service);

		return service;
	}

	async loadService(ref){
		const servicePath = 'services.'+ref;

		let service = this.ether.get(servicePath);

		if (!service){
			service = await this.ether.promised(servicePath, service => service);
		}

		return service;
	}

	async applyDecorator(ref, decoration){
		const service = await this.loadService(ref);

		service.decorate(decoration);

		return service;
	}

	async applyHook(ref, settings){
		const service = await this.loadService(ref);

		hook(service, settings);

		return service;
	}
}




module.exports = {
	Nexus
};
