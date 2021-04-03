
const {Config} = require('bmoor/src/lib/config.js');
const {create} = require('bmoor/src/lib/error.js');

const {hook} = require('../actors/hook.js');
const {Mapper} = require('../graph/mapper.js');

const {Model} = require('../schema/model.js');
const {Service} = require('../actors/service.js');
const {Composite} = require('../schema/composite.js');
const {Document} = require('../actors/document.js');

const config = new Config({
	timeout: 2000,
	constructors: {
		model: Model,
		service: Service,
		composite: Composite,
		document: Document
	}
});

const waiting = [];
async function secure(prom, label){
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

// TODO: a better way to debug the stack when something locks us
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

		return secure(
			this.ether.promised(path, res => res),
			path
		);
	}

	getModel(ref){
		return getDefined(this, 'model', this.constructors, ref, [ref]);
	}

	async configureModel(ref, settings){
		const model = await setSettings(this, 'model', this.getModel(ref), settings, ref);

		this.mapper.addModel(model);

		return model;
	}

	async loadModel(ref){
		return loadTarget(this, 'model', ref);
	}

	getService(ref){
		return getDefined(this, 'service', this.constructors, ref, [this.getModel(ref)]);
	}

	async configureService(ref, connector, settings = {}){
		await this.loadModel(ref);

		const service = this.getService(ref);

		await service.configure(connector, settings);

		await this.setConfigured('service', ref, service);

		return service;
	}

	async loadService(ref){
		return loadTarget(this, 'service', ref);
	}

	async configureDecorator(ref, decoration){
		const service = await this.loadService(ref);

		service.decorate(decoration);

		return service;
	}

	async configureHook(ref, settings){
		const service = await this.loadService(ref);

		hook(service, settings);

		return service;
	}

	// isAdmin can be defined on each model, allowing a new permission to be the admin permission 
	// for each model.  I am hoping this simplifies things rather than allowing an array to be passed
	// to has permission
	async configureSecurity(ref, settings){
		const accessCfg = {};

		// filters on data read out of the db
		accessCfg.filterFactory = settings.filter ? 
				typeof(settings.filter) === 'function' ? function(ctx){
					return (datum) => (settings.isAdmin && ctx.hasPermission(settings.isAdmin)) || 
						ctx.hasPermission(settings.filter(datum));
				}
				: function(ctx){
					return () => ctx.hasPermission(settings.filter) || 
						(settings.isAdmin && ctx.hasPermission(settings.isAdmin));
				}
			: null;

		// do you have a permission to write a particular datum
		if (settings.allowCreate){
			accessCfg.beforeCreate = async function(datum, ctx, service){
				const permission = await settings.allowCreate(datum);
				
				if (!(ctx.hasPermission(permission) || 
					(settings.isAdmin && ctx.hasPermission(settings.isAdmin)))
				){
					throw create('Not allowed to create', {
						status: 403,
						code: 'BMOOR_CRUD_NEXUS_ALLOW_CREATE',
						context: {
							model: service.structure.name
						}
					});
				}
			};
		}

		// do you have a permission to update a particular datum
		if (settings.allowUpdate){
			accessCfg.beforeUpdate = async function(id, delta, datum, ctx, service){
				const permission = await settings.allowUpdate(id, delta, datum);
				
				if (!(ctx.hasPermission(permission) || 
					(settings.isAdmin && ctx.hasPermission(settings.isAdmin)))
				){
					throw create('Not allowed to update', {
						status: 403,
						code: 'BMOOR_CRUD_NEXUS_ALLOW_UPDATE',
						context: {
							id,
							model: service.structure.name
						}
					});
				}
			};
		}

		// do you have a permission to delete a particular datum
		if (settings.allowDelete){
			accessCfg.beforeDelete = async function(id, datum, ctx, service){
				const permission = await settings.allowDelete(id, datum);
				
				if (!(ctx.hasPermission(permission) || 
					(settings.isAdmin && ctx.hasPermission(settings.isAdmin)))
				){
					throw create('Not allowed to delete', {
						status: 403,
						code: 'BMOOR_CRUD_NEXUS_ALLOW_DELETE',
						context: {
							id,
							model: service.structure.name
						}
					});
				}
			};
		}

		await this.configureHook(ref, accessCfg);

		const canCfg = {};

		if (settings.create){
			canCfg.beforeCreate = async function(datum, ctx, service){
				if (!ctx.hasPermission(settings.create)){
					throw create('Can not create', {
						status: 403,
						code: 'BMOOR_CRUD_NEXUS_CAN_CREATE',
						context: {
							model: service.structure.name
						}
					});
				}
			};
		}

		// do you have a permission to update a particular datum
		if (settings.update){
			canCfg.beforeUpdate = async function(id, delta, datum, ctx, service){
				if (!ctx.hasPermission(settings.update)){
					throw create('Can not update', {
						status: 403,
						code: 'BMOOR_CRUD_NEXUS_CAN_UPDATE',
						context: {
							id,
							model: service.structure.name
						}
					});
				}
			};
		}

		// do you have a permission to delete a particular datum
		if (settings.delete){
			canCfg.beforeDelete = async function(id, datum, ctx, service){
				if (!ctx.hasPermission(settings.delete)){
					throw create('Can not delete', {
						status: 403,
						code: 'BMOOR_CRUD_NEXUS_CAN_DELETE',
						context: {
							id,
							model: service.structure.name
						}
					});
				}
			};
		}

		return this.configureHook(ref, canCfg);
	}

	getComposite(ref){
		return getDefined(this, 'composite', this.constructors, ref, [ref]);
	}

	async configureComposite(ref, settings){
		settings.nexus = this;
		console.log('--> setting composite', ref);
		return setSettings(this, 'composite', this.getComposite(ref), settings, ref);
	}

	async loadComposite(ref){
		return loadTarget(this, 'composite', ref);
	}

	getDocument(ref){
		return getDefined(this, 'document', this.constructors, ref, [this.getComposite(ref)]);
	}

	async configureDocument(ref, connector, settings = {}){
		console.log('document configure -->', ref);
		await this.loadComposite(ref);

		const doc = this.getDocument(ref);
		console.log('document configuring -->', ref);
		await doc.configure(connector, settings);

		await this.setConfigured('document', ref, doc);
		console.log('document configured -->', ref);
		return doc;
	}

	async loadDocument(ref){
		return loadTarget(this, 'document', ref);
	}

	// I'm not putting loads below because nothing should be requiring these...
	getGuard(ref){
		return getDefined(this, 'guard', this.constructors, ref, [this.getService(ref)]);
	}

	async configureGuard(ref, settings){
		return setSettings(this, 'composite', this.getGuard(ref), settings, ref);
	}

	getAction(ref){
		return getDefined(this, 'action', this.constructors, ref, [this.getService(ref)]);
	}

	async configureAction(ref, settings){
		return setSettings(this, 'action', this.getAction(ref), settings, ref);
	}

	getUtility(ref){
		return getDefined(this, 'utility', this.constructors, ref, [this.getService(ref)]);
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
