const error = require('bmoor/src/lib/error.js');
const {Config} = require('bmoor/src/lib/config.js');

const config = new Config({
	putIsPatch: true
});

const {Controller, parseQuery, parseSettings} = require('../server/controller.js');

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

// query parameters:
// params: query variables... what are we searching by
// sort:
// limit:
// join: allow a way to join into the table from another place

// TODO: support pivot tables /model/id/[pivot]/[pivot]...
//   - security is managed as either checked on request or post read
// TODO: how would I handle pagination here?

function operationNotAllowed(operation) {
	throw error.create(`Operation (${operation}) is blocked`, {
		code: 'CRUD_CONTROLLER_GUARDED',
		type: 'warn',
		status: 400
	});
}

async function runUpdate(ids, guard, delta, ctx) {
	if (ids.length > 1) {
		return Promise.all(ids.map((key) => guard.view.update(key, delta, ctx)));
	} else if (ids.length === 1) {
		const key = ids[0];

		ctx.setInfo({key});

		return guard.view.update(key, delta, ctx, await parseSettings(guard.view, ctx));
	} else {
		throw error.create('called update without id', {
			code: 'CRUD_CONTROLLER_WRITE_ID',
			type: 'warn',
			status: 400
		});
	}
}

class Guard extends Controller {
	async read(ctx) {
		if (ctx.getMethod() === 'get') {
			if (!this.incomingSettings.read) {
				operationNotAllowed('read');
			}

			if (ctx.hasParam()) {
				let ids = ctx.getParam('id');

				if (ids) {
					ids = ids.split(',');
				}

				if (!ids) {
					throw error.create('called read without id', {
						code: 'CRUD_CONTROLLER_READ_ID',
						type: 'warn',
						status: 400
					});
				} else if (ids.length > 1) {
					return this.view.readMany(ids, ctx, await parseSettings(this.view, ctx));
				} else {
					return this.view
						.read(ids[0], ctx, await parseSettings(this.view, ctx))
						.then((res) => {
							if (!res) {
								throw error.create('called read without result', {
									code: 'CRUD_CONTROLLER_READ_ONE',
									type: 'warn',
									status: 404
								});
							}

							return res;
						});
				}
			} else if (ctx.hasQuery()) {
				if (!this.incomingSettings.query) {
					operationNotAllowed('query');
				}

				return this.view.query(
					await parseQuery(this.view, ctx),
					ctx,
					await parseSettings(this.view, ctx)
				);
			} else {
				return this.view.readAll(ctx, await parseSettings(this.view, ctx));
			}
		} else {
			throw error.create('called read with method ' + ctx.method, {
				code: 'CRUD_CONTROLLER_READ_UNAVAILABLE',
				type: 'warn',
				status: 405
			});
		}
	}

	// TODO: handle change structure to {payload: [datum]}
	async write(ctx) {
		const {payload} = await ctx.getContent();

		ctx.setInfo({
			model: this.view.structure.name
		});

		if (ctx.getMethod() === 'post') {
			if (!this.incomingSettings.create) {
				operationNotAllowed('create');
			}

			ctx.setInfo({
				action: 'create'
			});

			return this.view.create(payload, ctx, await parseSettings(this.view, ctx));
		} else if (ctx.getMethod() === 'put') {
			const ids = (ctx.getParam('id') || '').trim();

			if (!this.incomingSettings.update) {
				operationNotAllowed('update');
			}

			ctx.setInfo({
				action: 'update'
			});

			if (!ids) {
				throw error.create('called put without id', {
					code: 'CRUD_CONTROLLER_PUT_ID',
					type: 'warn',
					status: 400
				});
			} else if (config.get('putIsPatch')) {
				return runUpdate(ids.split(','), this, payload, ctx);
			} else {
				throw error.create('called write and tried to put, not ready', {
					code: 'CRUD_CONTROLLER_WRITE_NOTREADY',
					type: 'warn',
					status: 404
				});
			}
		} else if (ctx.getMethod() === 'patch') {
			if (!this.incomingSettings.update) {
				operationNotAllowed('update');
			}

			ctx.setInfo({
				action: 'update'
			});

			if (ctx.hasQuery()) {
				if (!this.incomingSettings.query) {
					operationNotAllowed('query');
				}

				const queriedIds = (
					await this.view.query(await parseQuery(this.view, ctx), ctx)
				).map((datum) => this.view.structure.getKey(datum));

				return runUpdate(queriedIds, this, payload, ctx);
			} else {
				const ids = (ctx.getParam('id') || '').trim();

				if (!ids) {
					throw error.create('called put without id', {
						code: 'CRUD_CONTROLLER_PATCH_ID',
						type: 'warn',
						status: 400
					});
				} else {
					return runUpdate(ids.split(','), this, payload, ctx);
				}
			}
		} else {
			throw error.create('called write with method ' + ctx.method, {
				code: 'CRUD_CONTROLLER_WRITE_UNAVAILABLE',
				type: 'warn',
				status: 405
			});
		}
	}

	async delete(ctx) {
		ctx.setInfo({
			model: this.view.structure.name,
			action: 'delete'
		});

		if (ctx.getMethod() === 'delete') {
			if (!this.incomingSettings.delete) {
				operationNotAllowed('delete');
			}

			if (ctx.hasQuery()) {
				if (!this.incomingSettings.query) {
					operationNotAllowed('query');
				}

				const queriedIds = (
					await this.view.query(await parseQuery(this.view, ctx), ctx)
				).map((datum) => this.view.structure.getKey(datum));

				return Promise.all(queriedIds.map((id) => this.view.delete(id, ctx)));
			} else {
				let ids = (ctx.getParam('id') || '').trim();

				if (!ids) {
					throw error.create('called update without id', {
						code: 'CRUD_CONTROLLER_DELETE_ID',
						type: 'warn',
						status: 400
					});
				} else {
					ids = ids.split(',');

					if (ids.length > 1) {
						return Promise.all(ids.map((id) => this.view.delete(id, ctx)));
					} else {
						return this.view.delete(ids[0], ctx);
					}
				}
			}
		} else {
			throw error.create('called write with method ' + ctx.method, {
				code: 'CRUD_CONTROLLER_DELETE_UNAVAILABLE',
				type: 'warn',
				status: 405
			});
		}
	}

	async route(ctx) {
		if (ctx.getMethod() === 'get') {
			return this.read(ctx);
		} else if (ctx.getMethod() === 'delete') {
			return this.delete(ctx);
		} else {
			return this.write(ctx);
		}
	}

	_buildRoutes() {
		return [
			{
				// create
				route: {
					path: '',
					method: 'post'
				},
				fn: (ctx) => this.write(ctx),
				hidden: !this.incomingSettings.create,
				structure: this.view.structure
			},
			{
				// read / readMany
				route: {
					path: '/:id',
					method: 'get'
				},
				fn: (ctx) => this.read(ctx),
				hidden: !this.incomingSettings.read,
				structure: this.view.structure
			},
			{
				// readAll, query
				route: {
					path: '',
					method: 'get'
				},
				fn: (ctx) => this.read(ctx),
				hidden: !this.incomingSettings.read,
				structure: this.view.structure
			},
			{
				// update
				route: {
					path: '/:id',
					method: 'put'
				},
				fn: (ctx) => this.write(ctx),
				hidden: !this.incomingSettings.update,
				structure: this.view.structure
			},
			{
				// update
				route: {
					path: '/:id',
					method: 'patch'
				},
				fn: (ctx) => this.write(ctx),
				hidden: !this.incomingSettings.update,
				structure: this.view.structure
			},
			{
				// update
				route: {
					path: '',
					method: 'patch'
				},
				fn: (ctx) => this.write(ctx),
				hidden: !this.incomingSettings.update,
				structure: this.view.structure
			},
			{
				// delete
				route: {
					path: '/:id',
					method: 'delete'
				},
				fn: (ctx) => this.delete(ctx),
				hidden: !this.incomingSettings.delete,
				structure: this.view.structure
			},
			{
				// delete w/ query
				route: {
					path: '',
					method: 'delete'
				},
				fn: (ctx) => this.delete(ctx),
				hidden: !(this.incomingSettings.delete && this.incomingSettings.query),
				structure: this.view.structure
			}
		];
	}
}

module.exports = {
	config,
	Guard
};
