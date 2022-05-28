const {Config} = require('bmoor/src/lib/config.js');
const {Registry} = require('bmoor/src/lib/registry.js');

const {hook} = require('../services/hook.js');
const {secure} = require('../services/secure.js');
const {Mapper} = require('../graph/mapper.js');

const {Crud} = require('../services/crud.js');
const {Model} = require('../schema/model.js');
const {Source} = require('../services/source.js');
const {Document} = require('../services/document.js');
const {Composite} = require('../schema/composite.js');
const {Guard} = require('../controllers/guard.js');
const {Action} = require('../controllers/action.js');
const {Utility} = require('../controllers/utility.js');
const {Synthetic} = require('../controllers/synthetic.js');

const schemas = new Config({
	source: Source,
	model: Model,
	composite: Composite
});

const services = new Config({
	crud: Crud,
	document: Document
});

const controllers = new Config({
	guard: Guard,
	action: Action,
	utility: Utility,
	synthetic: Synthetic
});

const config = new Config(
	{
		timeout: 2000
	},
	{
		schemas,
		services,
		controllers
	}
);

const waiting = {};
async function ensure(settings, prom, label) {
	if (waiting[label]) {
		waiting[label].count++;
	} else {
		const promise = new Promise((resolve, reject) => {
			const timeout = settings.get('timeout');

			const clear = setTimeout(function () {
				reject(new Error('lookup timed out: ' + label));
			}, timeout);

			prom.then(
				(success) => {
					delete waiting[label];

					clearTimeout(clear);
					resolve(success);
				},
				(failure) => {
					clearTimeout(clear);
					reject(failure);
				}
			);
		});

		waiting[label] = {
			count: 1,
			promise
		};
	}

	return waiting[label].promise;
}

function getDefined(nexus, type, constructors, ref, args) {
	let model = nexus.getDefined(type, ref);

	if (!model) {
		const Build = constructors.get(type);

		if (!Build) {
			throw new Error(`Unknown constructor: ${type}`);
		}

		model = new Build(...args);

		nexus.setDefined(type, ref, model);
	}

	return model;
}

async function setSettings(nexus, type, target, settings, ref) {
	await target.configure(settings);

	await nexus.setConfigured(type, ref, target);

	return target;
}

async function loadTarget(nexus, type, ref) {
	let entity = nexus.getConfigured(type, ref);

	if (!entity) {
		entity = await nexus.awaitConfigured(type, ref);
	}

	return entity;
}

class Nexus {
	constructor(cfg = config) {
		this.config = cfg;

		this.ether = new Registry();
		this.mapper = new Mapper();
	}

	getDefined(type, ref) {
		return this.ether.get(`defined.${type}.${ref}`);
	}

	setDefined(type, ref, value) {
		return this.ether.set(`defined.${type}.${ref}`, value);
	}

	getConfigured(type, ref) {
		return this.ether.get(`configured.${type}.${ref}`);
	}

	setConfigured(type, ref, value) {
		return this.ether.set(`configured.${type}.${ref}`, value);
	}

	async awaitConfigured(type, ref) {
		const path = `configured.${type}.${ref}`;

		return ensure(
			this.config,
			this.ether.promised(path, (res) => res),
			path
		);
	}

	// factory is run in the source constructor, passing in settings and nexus
	async setConnector(ref, factory) {
		await this.setConfigured('connector', ref, factory);

		return factory;
	}

	async loadConnector(ref) {
		if (!ref) {
			throw new Error('invalid connector requested: ' + ref);
		}

		return loadTarget(this, 'connector', ref);
	}

	getSource(ref) {
		return getDefined(this, 'source', this.config.getSub('schemas'), ref, [
			ref,
			this
		]);
	}

	async configureSource(ref, settings) {
		const source = await setSettings(
			this,
			'source',
			this.getSource(ref),
			settings,
			ref
		);

		return source;
	}

	async loadSource(ref) {
		if (!ref) {
			throw new Error('invalid source requested: ' + ref);
		}

		return loadTarget(this, 'source', ref);
	}

	async loadStructure(ref) {
		if (!ref) {
			throw new Error('invalid structure requested: ' + ref);
		}

		return loadTarget(this, 'structure', ref);
	}

	getModel(ref) {
		return getDefined(this, 'model', this.config.getSub('schemas'), ref, [
			ref,
			this
		]);
	}

	async configureModel(ref, settings) {
		const model = await setSettings(
			this,
			'model',
			this.getModel(ref),
			settings,
			ref
		);

		this.mapper.addModel(model);

		this.setConfigured('structure', ref, model);

		return model;
	}

	async loadModel(ref) {
		if (!ref) {
			throw new Error('invalid model requested: ' + ref);
		}

		return loadTarget(this, 'model', ref);
	}

	getCrud(ref) {
		return getDefined(this, 'crud', this.config.getSub('services'), ref, [
			this.getModel(ref)
		]);
	}

	async configureCrud(ref, settings = {}) {
		await this.loadModel(ref);

		const crud = this.getCrud(ref);

		await crud.configure(settings);
		await crud.build();

		await this.setConfigured('crud', ref, crud);

		return crud;
	}

	async loadCrud(ref) {
		return loadTarget(this, 'crud', ref);
	}

	async configureDecorator(ref, decoration) {
		const service = await this.loadCrud(ref);

		service.decorate(decoration);

		return service;
	}

	async configureHook(ref, settings) {
		const service = await this.loadCrud(ref);

		hook(service, settings);

		return service;
	}

	async configureSecurity(ref, settings) {
		const service = await this.loadCrud(ref);

		secure(service, settings);

		return service;
	}

	getComposite(ref) {
		return getDefined(this, 'composite', this.config.getSub('schemas'), ref, [
			ref,
			this
		]);
	}

	async configureComposite(ref, settings) {
		const composite = await setSettings(
			this,
			'composite',
			this.getComposite(ref),
			settings,
			ref
		);

		this.setConfigured('structure', ref, composite);

		return composite;
	}

	async loadComposite(ref) {
		if (!ref) {
			throw new Error('invalid composite requested: ' + ref);
		}

		return loadTarget(this, 'composite', ref);
	}

	getDocument(ref) {
		return getDefined(this, 'document', this.config.getSub('services'), ref, [
			this.getComposite(ref)
		]);
	}

	async configureDocument(ref, settings = {}) {
		await this.loadComposite(ref);

		const doc = this.getDocument(ref);

		await doc.configure(settings);
		await doc.build();

		await this.setConfigured('document', ref, doc);

		return doc;
	}

	async loadDocument(ref) {
		return loadTarget(this, 'document', ref);
	}

	// I'm not putting loads below because nothing should be requiring these...
	getGuard(ref) {
		return getDefined(this, 'guard', this.config.getSub('controllers'), ref, [
			this.getCrud(ref)
		]);
	}

	async configureGuard(ref, settings) {
		return setSettings(this, 'composite', this.getGuard(ref), settings, ref);
	}

	getAction(ref) {
		return getDefined(this, 'action', this.config.getSub('controllers'), ref, [
			this.getCrud(ref)
		]);
	}

	async configureAction(ref, settings) {
		return setSettings(this, 'action', this.getAction(ref), settings, ref);
	}

	getUtility(ref) {
		return getDefined(this, 'utility', this.config.getSub('controllers'), ref, [
			this.getCrud(ref)
		]);
	}

	async configureUtility(ref, settings) {
		return setSettings(this, 'utility', this.getUtility(ref), settings, ref);
	}

	getSynthetic(ref) {
		return getDefined(
			this,
			'synthetic',
			this.config.getSub('controllers'),
			ref,
			[this.getDocument(ref)]
		);
	}

	async configureSynthetic(ref, settings) {
		return setSettings(
			this,
			'synthetic',
			this.getSynthetic(ref),
			settings,
			ref
		);
	}
}

module.exports = {
	config,
	Nexus
};
