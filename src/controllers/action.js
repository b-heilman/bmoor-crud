const error = require('bmoor/src/lib/error.js');
const {skewerToCamel} = require('bmoor/src/string.js');

const {Controller} = require('../server/controller.js');

// actions performed against a class, but a particular instance
class Action extends Controller {
	async configure(settings) {
		this.settings = Object.keys(settings).reduce((agg, key) => {
			agg[key.toLowerCase()] = settings[key];

			return agg;
		}, {});
	}

	async route(ctx) {
		const action = ctx.getParam('action');
		const id = ctx.getParam('id');

		const setting = this.settings[action];

		if (!setting) {
			throw error.create('action method not found', {
				code: 'ACTION_CONTROLLER_NO_ACTION',
				type: 'warn',
				status: 404
			});
		} else if (ctx.getMethod() !== setting.method) {
			throw error.create('action method not found', {
				code: 'ACTION_CONTROLLER_WRONG_METHOD',
				type: 'warn',
				status: 404
			});
		}

		if (setting.permission && !ctx.hasPermission(setting.permission)) {
			throw error.create('do not have required permission for action', {
				code: 'ACTION_CONTROLLER_PERMISSION',
				type: 'warn',
				status: 404
			});
		}

		const method = skewerToCamel(action);

		if (!this.view[method]) {
			throw error.create('method was not found with service', {
				code: 'ACTION_CONTROLLER_METHOD',
				type: 'warn',
				status: 404
			});
		}

		let datum = null;

		if (setting.readBy) {
			// TODO: test-me
			datum = (await this.view.query({[setting.readBy]: id}))[0];
		} else {
			datum = await this.view.read(id, ctx);
		}

		const params = setting.parseParams
			? setting.parseParams(datum, ctx)
			: [datum, ctx];

		return this.view[method](...params);
	}

	_buildRoutes() {
		return Object.keys(this.settings).map((key) => {
			const setting = this.settings[key];

			return {
				route: {
					method: setting.method,
					path: '/' + key + '/:id'
				},
				fn: async (ctx) => {
					ctx.setParam('action', key);

					return this.route(ctx);
				},
				structure: this.view.structure
			};
		});
	}
}

module.exports = {
	Action
};
