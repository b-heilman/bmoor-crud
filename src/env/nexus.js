
const {Config} = require('bmoor/src/lib/config.js');

const {hook} = require('../services/hook.js');
const {secure} = require('../services/secure.js');
const {Mapper} = require('../graph/mapper.js');

const {Model} = require('../schema/model.js');
const {Crud} = require('../services/crud.js');
const {Composite} = require('../schema/composite.js');
const {Document} = require('../services/document.js');

const config = new Config({
	timeout: 2000,
	constructors: {
		model: Model,
		crud: Crud,
		composite: Composite,
		document: Document
	}
});

const waiting = [];
async function ensure(prom, label){
	waiting.push(label);

	return new Promise((resolve, reject) => {
		const timeout = config.get('timeout');

		const clear = setTimeout(function(){
			console.log('nexus stack', JSON.stringify(waiting, null, 2));

			reject(new Error('lookup timed out: '+label));
		}, timeout);

		prom.then(
			success => {
				const index = waiting.indexOf(label);
				if (index > -1) {
					waiting.splice(index, 1);
				}

				clearTimeout(clear);
				resolve(success);
			},
			failure => {
				clearTimeout(clear);
				reject(failure);
			}
		);
	});
}

function getDefined(nexus, type, constructors, ref, args){
	let model = nexus.getDefined(type, ref);

	if (!model){
		const Build = constructors.get(type);

		if (!Build){
			throw new Error(`Unknown constructor: ${type}`);
		}

		model = new Build(...args);

		nexus.setDefined(type, ref, model);
	}

	return model;
}

async function setSettings(nexus, type, target, settings, ref){
	await target.configure(settings);
	await nexus.setConfigured(type, ref, target);

	return target;
}

async function loadTarget(nexus, type, ref){
	let entity = nexus.getConfigured(type, ref);

	if (!entity){
		entity = await nexus.awaitConfigured(type, ref);
	}

	return entity;
}

class Nexus {
	constructor(constructors){
		this.constructors = constructors || config.sub('constructors');

		this.ether = new Config({});
		this.mapper = new Mapper();
	}

	getDefined(type, ref){
		return this.ether.get(`defined.${type}.${ref}`);
	}

	setDefined(type, ref, value){
		return this.ether.set(`defined.${type}.${ref}`, value);
	}

	getConfigured(type, ref){
		return this.ether.get(`configured.${type}.${ref}`);
	}

	setConfigured(type, ref, value){
		return this.ether.set(`configured.${type}.${ref}`, value);
	}

	async awaitConfigured(type, ref){
		const path = `configured.${type}.${ref}`;

		return ensure(
			this.ether.promised(path, res => res),
			path
		);
	}

	getModel(ref){
		return getDefined(this, 'model', this.constructors, ref, [ref, this]);
	}

	async configureModel(ref, settings){
		const model = await setSettings(this, 'model', this.getModel(ref), settings, ref);

		this.mapper.addModel(model);

		return model;
	}

	async loadModel(ref){
		return loadTarget(this, 'model', ref);
	}

	getCrud(ref){
		return getDefined(this, 'crud', this.constructors, ref, [this.getModel(ref)]);
	}

	async configureCrud(ref, connector, settings = {}){
		await this.loadModel(ref);

		const service = this.getCrud(ref);

		await service.configure(connector, settings);

		await this.setConfigured('service', ref, service);

		return service;
	}

	async loadCrud(ref){
		return loadTarget(this, 'service', ref);
	}

	async configureDecorator(ref, decoration){
		const service = await this.loadCrud(ref);

		service.decorate(decoration);

		return service;
	}

	async configureHook(ref, settings){
		const service = await this.loadCrud(ref);

		hook(service, settings);

		return service;
	}

	async configureSecurity(ref, settings){
		const service = await this.loadCrud(ref);

		secure(service, settings);

		return service;
	}

	getComposite(ref){
		return getDefined(this, 'composite', this.constructors, ref, [ref, this]);
	}

	async configureComposite(ref, settings){
		return setSettings(this, 'composite', this.getComposite(ref), settings, ref);
	}

	async loadComposite(ref){
		return loadTarget(this, 'composite', ref);
	}

	getDocument(ref){
		return getDefined(this, 'document', this.constructors, ref, [this.getComposite(ref)]);
	}

	async configureDocument(ref, connector, settings = {}){
		await this.loadComposite(ref);

		const doc = this.getDocument(ref);
		
		await doc.configure(connector, settings);

		await this.setConfigured('document', ref, doc);
		
		return doc;
	}

	async loadDocument(ref){
		return loadTarget(this, 'document', ref);
	}

	// I'm not putting loads below because nothing should be requiring these...
	getGuard(ref){
		return getDefined(this, 'guard', this.constructors, ref, [this.getCrud(ref)]);
	}

	async configureGuard(ref, settings){
		return setSettings(this, 'composite', this.getGuard(ref), settings, ref);
	}

	getAction(ref){
		return getDefined(this, 'action', this.constructors, ref, [this.getCrud(ref)]);
	}

	async configureAction(ref, settings){
		return setSettings(this, 'action', this.getAction(ref), settings, ref);
	}

	getUtility(ref){
		return getDefined(this, 'utility', this.constructors, ref, [this.getCrud(ref)]);
	}

	async configureUtility(ref, settings){
		return setSettings(this, 'utility', this.getUtility(ref), settings, ref);
	}

	getSynthetic(ref){
		return getDefined(this, 'synthetic', this.constructors, ref, [this.getDocument(ref)]);
	}

	async configureSynthetic(ref, settings){
		return setSettings(this, 'synthetic', this.getSynthetic(ref), settings, ref);
	}

	toJSON(){
		console.trace();
	}
}

module.exports = {
	config,
	Nexus
};
