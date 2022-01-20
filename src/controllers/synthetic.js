const error = require('bmoor/src/lib/error.js');

const {Controller, parseQuery} = require('../server/controller.js');

class Synthetic extends Controller {
	async configure(settings) {
		this.settings = settings;
	}

	async route(ctx) {
		if (ctx.getMethod() === 'post') {
			if (!this.settings.writable) {
				throw error.create('document is not writable', {
					code: 'DOCUMENT_CONTROLLER_WRITE_UNAVAILABLE',
					type: 'warn',
					status: 400
				});
			}

			if (this.settings.write && !ctx.hasPermission(this.settings.write)) {
				throw error.create('not allowed to write to document', {
					code: 'DOCUMENT_CONTROLLER_WRITE_PERMISSION',
					type: 'warn',
					status: 405
				});
			}

			return this.view.push(await ctx.getContent(), ctx);
		} else if (ctx.getMethod() === 'get') {
			if (!this.settings.readable) {
				throw error.create('document is not readable', {
					code: 'DOCUMENT_CONTROLLER_READ_UNAVAILABLE',
					type: 'warn',
					status: 400
				});
			}

			if (this.settings.read && !ctx.hasPermission(this.settings.read)) {
				throw error.create('not allowed to read from document', {
					code: 'DOCUMENT_CONTROLLER_READ_PERMISSION',
					type: 'warn',
					status: 405
				});
			}

			if (ctx.hasParam('id')) {
				return this.view.read(ctx.getParam('id'), ctx);
			} else {
				await this.view.link();

				return this.view.query(await parseQuery(this.view.base, ctx), ctx);
			}
		} else {
			throw error.create('called read with method ' + ctx.method, {
				code: 'DOCUMENT_CONTROLLER_UNAVAILABLE',
				type: 'warn',
				status: 405
			});
		}
	}

	_buildRoutes() {
		return [
			/*{
			route: {
				path: '',
				method: 'post'
			},
			fn: (ctx) => this.route(ctx),
			structure: this.view.structure
		}, */ {
				route: {
					path: '/:id',
					method: 'get'
				},
				fn: (ctx) => this.route(ctx),
				structure: this.view.structure
			},
			{
				route: {
					path: '',
					method: 'get'
				},
				fn: (ctx) => this.route(ctx),
				structure: this.view.structure
			}
		];
	}
}

module.exports = {
	Synthetic
};
