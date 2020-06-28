
const {Config} = require('bmoor/src/lib/config.js');
const {create} = require('bmoor/src/lib/error.js');

const {Model} = require('../model.js');
const {Service} = require('../service.js');
const {hook} = require('../hook.js');
const {Mapper} = require('../graph/mapper.js');
const {Composite} = require('../synthetics/composite.js');

const config = new Config({
	timeout: 2000
});

async function secure(prom, label){
	return new Promise((resolve, reject) => {
		const timeout = config.get('timeout');

		const clear = setTimeout(function(){
			reject(new Error('lookup timed out: '+label));
		}, timeout);

		prom.then(
			success => {
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

class Nexus {
	constructor(){
		this.ether = new Config({
			models: {},
			services: {},
			composites: {}
		});
		this.mapper = new Mapper();
	}

	async setModel(ref, settings){
		const path = 'models.'+ref;
		const model = new Model(ref, settings);

		this.mapper.addModel(model);

		await this.ether.set(path, model);

		return model;
	}

	async loadModel(ref){
		const modelPath = 'models.'+ref;
		
		let model = this.ether.get(modelPath);

		if (!model){
			model = await secure(
				this.ether.promised(modelPath, model => model),
				modelPath
			);
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
			service = await secure(
				this.ether.promised(servicePath, service => service),
				servicePath
			);
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

	// isAdmin can be defined on each model, allowing a new permission to be the admin permission 
	// for each model.  I am hoping this simplifies things rather than allowing an array to be passed
	// to has permission
	async applySecurity(ref, settings){
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
							model: service.schema.name
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
							model: service.schema.name
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
							model: service.schema.name
						}
					});
				}
			};
		}

		await this.applyHook(ref, accessCfg);

		const canCfg = {};

		if (settings.create){
			canCfg.beforeCreate = async function(datum, ctx, service){
				if (!ctx.hasPermission(settings.create)){
					throw create('Can not create', {
						status: 403,
						code: 'BMOOR_CRUD_NEXUS_CAN_CREATE',
						context: {
							model: service.schema.name
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
							model: service.schema.name
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
							model: service.schema.name
						}
					});
				}
			};
		}

		return this.applyHook(ref, canCfg);
	}

	async installComposite(ref, connector, settings){
		const composite = new Composite(this, connector, settings);

		await composite.ready;

		await this.ether.set('composites.'+ref, composite);

		return composite;
	}

	async loadComposite(ref){
		const compositePath = 'composites.'+ref;

		let composite = this.ether.get(compositePath);

		if (!composite){
			composite = await secure(
				this.ether.promised(compositePath, composite => composite),
				compositePath
			);
		}

		return composite;
	}
}

module.exports = {
	Nexus
};
