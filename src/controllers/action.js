
const error = require('bmoor/src/lib/error.js');

const {Controller} = require('../server/controller.js');

// TODO: move this to bmoor string
function camelize(str){
	const arr = str.split('-');
	const capital = arr.map(
		(item, index) => index ? 
			item.charAt(0).toUpperCase() + item.slice(1).toLowerCase() : item
	);
	
	return capital.join('');
}

// actions performed against a class, but a particular instance
class Action extends Controller {
	constructor(service, settings){
		super();
		
		this.service = service;
		this.settings = Object.keys(settings)
		.reduce((agg, key) => {
			agg[key.toLowerCase()] = settings[key];

			return agg;
		}, {});
	}

	async route(ctx){
		const action = ctx.getParam('action');
		const id = ctx.getParam('id');

		const setting = this.settings[action];

		if (!setting){
			throw error.create('action method not found', {
				code: 'ACTION_CONTROLLER_NO_ACTION',
				type: 'warn',
				status: 404
			});
		} else if (ctx.getMethod() !== setting.method){
			throw error.create('action method not found', {
				code: 'ACTION_CONTROLLER_WRONG_METHOD',
				type: 'warn',
				status: 404
			});
		} 

		if (setting.permission && !ctx.hasPermission(setting.permission)){
			throw error.create('do not have required permission for action', {
				code: 'ACTION_CONTROLLER_PERMISSION',
				type: 'warn',
				status: 404
			});
		}

		const method = camelize(action);

		if (!this.service[method]){
			throw error.create('method was not found with service', {
				code: 'ACTION_CONTROLLER_METHOD',
				type: 'warn',
				status: 404
			});
		}

		const datum = this.service.read(id);
		const params = setting.parseParams	?
			setting.parseParams(ctx, datum) : [ctx];
		
		return this.service[method](...params);
	}

	getRoutes(nexus){
		const run = this.route.bind(this);
		
		return Object.key(this.settings)
		.map(key => {
			const setting = this.settings[key];

			return this.prepareRoute(
				nexus,
				setting.method,
				'/'+key+'/:id',
				async function(ctx){
					ctx.setParam('action', key);

					return run(ctx);
				}
			);
		});
	}
}

module.exports = {
	Action
};
