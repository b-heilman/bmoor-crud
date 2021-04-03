   
const error = require('bmoor/src/lib/error.js');
const {Config} = require('bmoor/src/lib/config.js');

const config = new Config({
	putIsPatch: true
});

const {Controller} = require('../server/controller.js');

// -- post
// create => POST: ''

// -- get: read, readMany, readAll, query
// ? how to apply query to sub select of all / many / event read
// read => GET: '/'+[id]
// readMany => GET: '/'+[id1,id2,id3]
// readAll => GET: ''
// ! these are secured by after read filter

// -- put: update
// update => PUT: '/'+[id] -> send full update
// update => PATCH: '/'+[id] -> send merge content
// ! allow PUT to act like patch

// -- delete: delete
// ? how to apply query to sub select of all / many / event read
// delete => DELETE: '/'+[id]
// delete => DELETE: '/'+[id1,id2]
// delete => DELETE: ''+query

function operationNotAllowed(operation){
	throw error.create(`Operation (${operation}) is blocked`, {
		code: 'CRUD_CONTROLLER_GUARDED',
		type: 'warn',
		status: 400
	});
}

async function runUpdate(ids, service, delta, ctx){
	let rtn = null;

	if (ids.length > 1){
		return Promise.all(ids.map(
			key => service.update(key, delta, ctx)
		));
	} else if (ids.length === 1){
		const key = ids[0];

		ctx.setInfo({key});

		return service.update(key, delta, ctx);
	} else {
		throw error.create('called update without id', {
			code: 'CRUD_CONTROLLER_WRITE_ID',
			type: 'warn',
			status: 400
		});
	}

	return rtn;
}

class Guard extends Controller {
	constructor(service){
		super(service.structure);
		
		this.service = service;
	}

	async read(ctx){
		if (ctx.getMethod() === 'get'){
			if (!this.settings.read){
				operationNotAllowed('read');
			}

			if (ctx.hasQuery()){
				if (!this.settings.query){
					operationNotAllowed('query');
				}

				return this.service.query(ctx.getQuery(), ctx);
			} else if (ctx.params){
				let ids = ctx.getParam('id');

				if (ids){
					ids = ids.split(',');
				}

				if (!ids){
					throw error.create('called read without id', {
						code: 'CRUD_CONTROLLER_READ_ID',
						type: 'warn',
						status: 400
					});
				} else if (ids.length > 1){
					return this.service.readMany(ids, ctx);
				} else {
					return this.service.read(ids[0], ctx)
					.then(res => {
						if (!res){
							throw error.create('called read without result', {
								code: 'CRUD_CONTROLLER_READ_ONE',
								type: 'warn',
								status: 404
							});
						}

						return res;
					});
				}
			} else {
				return this.service.readAll(ctx);
			}
		} else {
			throw error.create('called read with method '+ctx.method, {
				code: 'CRUD_CONTROLLER_READ_UNAVAILABLE',
				type: 'warn',
				status: 405
			});
		}
	}

	async write(ctx){
		const datum = await ctx.getContent();

		ctx.setInfo({
			model: this.service.structure.name
		});

		if (ctx.getMethod() === 'post'){
			if (!this.settings.create){
				operationNotAllowed('create');
			}

			ctx.setInfo({
				action: 'create'
			});

			return this.service.create(datum, ctx);
		} else if (ctx.getMethod() === 'put'){
			const ids = (ctx.getParam('id')||'').trim();

			if (!this.settings.update){
				operationNotAllowed('update');
			}

			ctx.setInfo({
				action: 'update'
			});

			if (!ids){
				throw error.create('called put without id', {
					code: 'CRUD_CONTROLLER_PUT_ID',
					type: 'warn',
					status: 400
				});
			} else if (config.get('putIsPatch')){
				return runUpdate(ids.split(','), this.service, datum, ctx);
			} else {
				throw error.create('called write and tried to put, not ready', {
					code: 'CRUD_CONTROLLER_WRITE_NOTREADY',
					type: 'warn',
					status: 404
				});
			}
			
		} else if (ctx.getMethod() === 'patch'){
			const ids = (ctx.getParam('id')||'').trim();

			if (!this.settings.update){
				operationNotAllowed('update');
			}

			ctx.setInfo({
				action: 'update'
			});

			if (!ids){
				throw error.create('called put without id', {
					code: 'CRUD_CONTROLLER_PATCH_ID',
					type: 'warn',
					status: 400
				});
			} else {
				return runUpdate(ids.split(','), this.service, datum, ctx);
			}
		} else {
			throw error.create('called write with method '+ctx.method, {
				code: 'CRUD_CONTROLLER_WRITE_UNAVAILABLE',
				type: 'warn',
				status: 405
			});
		}
	}

	async delete(ctx){
		ctx.setInfo({
			model: this.service.structure.name,
			action: 'delete'
		});

		if (ctx.getMethod() === 'delete'){
			if (!this.settings.delete){
				operationNotAllowed('delete');
			}

			if (ctx.hasQuery()){
				if (!this.settings.query){
					operationNotAllowed('query');
				}

				const queriedIds = (await this.service.query(ctx.getQuery(), ctx))
					.map(datum => this.service.structure.getKey(datum));

				return Promise.all(queriedIds.map(
					id => this.service.delete(id, ctx)
				));
			} else {
				let ids = (ctx.getParam('id')||'').trim();

				if (!ids){
					throw error.create('called update without id', {
						code: 'CRUD_CONTROLLER_DELETE_ID',
						type: 'warn',
						status: 400
					});
				} else {
					ids = ids.split(',');

					if (ids.length > 1){
						return Promise.all(ids.map(
							id => this.service.delete(id, ctx)
						));
					} else {
						return this.service.delete(ids[0], ctx);
					}
				}
			}
		} else {
			throw error.create('called write with method '+ctx.method, {
				code: 'CRUD_CONTROLLER_DELETE_UNAVAILABLE',
				type: 'warn',
				status: 405
			});
		}
	}

	async route(ctx){
		if (ctx.getMethod() === 'get'){
			return this.read(ctx);
		} else if (ctx.getMethod() === 'delete'){
			return this.delete(ctx);
		} else {
			return this.write(ctx);
		}
	}

	_buildRoutes(){
		return [{
			// create
			route: {
				path: '',
				method: 'post'
			}, 
			fn: (ctx) => this.write(ctx),
			hidden: !this.settings.create,
			structure: this.service.structure
		}, {
			// read / readMany
			route: {
				path: '/:id',
				method: 'get'
			},
			fn: (ctx) => this.read(ctx),
			hidden: !this.settings.read,
			structure: this.service.structure
		}, {
			// readAll, query
			route: {
				path: '',
				method: 'get'
			},
			fn: (ctx) => this.read(ctx),
			hidden: !this.settings.read,
			structure: this.service.structure
		}, {
			// update
			route: {
				path: '/:id',
				method: 'put'
			},
			fn: (ctx) => this.write(ctx),
			hidden: !this.settings.update,
			structure: this.service.structure
		}, {
			// update
			route: {
				path: '/:id',
				method: 'patch',
			},
			fn: (ctx) => this.write(ctx),
			hidden: !this.settings.update,
			structure: this.service.structure
		}, {
			// delete
			route: {
				path: '/:id',
				method: 'delete',
			},
			fn: (ctx) => this.delete(ctx),
			hidden: !this.settings.delete,
			structure: this.service.structure
		}, {
			// delete w/ query
			route: {
				path: '',
				method: 'delete',
			},
			fn: (ctx) => this.delete(ctx),
			hidden: !(this.settings.delete && this.settings.query),
			structure: this.service.structure
		}];
	}

	getRoutes(nexus){
		return this._buildRoutes()
		.map(routeInfo => this.prepareRoute(
			nexus, 
			routeInfo
		));
	}
}

module.exports = {
	config,
	Guard
};
