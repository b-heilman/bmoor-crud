
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

function runUpdate(ids, service, delta, ctx){
	if (ids.length > 1){
		return Promise.all(ids.map(
			id => service.update(id, delta, ctx)
		));
	} else if (ids.length === 1){
		return service.update(ids[0], delta, ctx);
	} else {
		throw error.create('called update without id', {
			code: 'CRUD_CONTROLLER_WRITE_ID',
			type: 'warn',
			status: 400
		});
	}
}

class Guard extends Controller {
	constructor(service, settings){
		super();
		
		this.service = service;
		this.settings = settings;
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

		if (ctx.getMethod() === 'post'){
			if (!this.settings.create){
				operationNotAllowed('create');
			}

			return this.service.create(datum, ctx);
		} else if (ctx.getMethod() === 'put'){
			const ids = (ctx.getParam('id')||'').trim();

			if (!this.settings.update){
				operationNotAllowed('update');
			}

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
		if (ctx.getMethod() === 'delete'){
			if (!this.settings.delete){
				operationNotAllowed('delete');
			}

			if (ctx.hasQuery()){
				if (!this.settings.query){
					operationNotAllowed('query');
				}

				const queriedIds = (await this.service.query(ctx.getQuery(), ctx))
					.map(datum => this.service.schema.getKey(datum));

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

	getRoutes(nexus){
		const read = this.read.bind(this);
		const write = this.write.bind(this);
		const del = this.delete.bind(this);

		return [
			// create
			this.prepareRoute(nexus, 'post', '', write),

			// read / readMany
			this.prepareRoute(nexus, 'get', '/:id', read), 

			// readAll, query
			this.prepareRoute(nexus, 'get', '', read),

			// update
			this.prepareRoute(nexus, 'put', '/:id', write),

			// update
			this.prepareRoute(nexus, 'patch', '/:id', write), 

			// delete
			this.prepareRoute(nexus, 'delete', '/:id', del),

			// delete w/ query
			this.prepareRoute(nexus, 'delete', '', del)
		];
	}
}

module.exports = {
	config,
	Guard
};
