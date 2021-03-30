
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
class Utility extends Controller {
	constructor(service){
		super(service.structure);
		
		this.service = service;
	}

	async configure(settings){
		this.settings = Object.keys(settings)
		.reduce((agg, key) => {
			agg[key.toLowerCase()] = settings[key];

			return agg;
		}, {});
	}

	async route(ctx){
		const utility = ctx.getParam('utility');

		const setting = this.settings[utility];

		if (!setting){
			throw error.create('utility method not found', {
				code: 'UTILITY_CONTROLLER_NO_UTILITY',
				type: 'warn',
				status: 404
			});
		} else if (ctx.getMethod() !== setting.method){
			throw error.create('utility method not found', {
				code: 'UTILITY_CONTROLLER_WRONG_METHOD',
				type: 'warn',
				status: 404
			});
		} 

		if (setting.permission && !ctx.hasPermission(setting.permission)){
			throw error.create('do not have required permission for utility', {
				code: 'UTILITY_CONTROLLER_PERMISSION',
				type: 'warn',
				status: 404
			});
		}

		const fn = camelize(utility);

		if (!this.service[fn]){
			throw error.create('method was not found with service', {
				code: 'UTILITY_CONTROLLER_METHOD',
				type: 'warn',
				status: 404
			});
		}

		const params = setting.parseParams	?
			setting.parseParams(ctx) : [ctx];
		
		return this.service[fn](...params);
	}

	_buildRoutes(){
		return Object.key(this.settings)
		.map(key => {
			const setting = this.settings[key];

			return {
				route: {
					method: setting.method,
					path: '/'+key
				},
				fn: async (ctx) => {
					ctx.setParam('utility', key);

					return this.route(ctx);
				}
				// TODO: structure: ????
			};
		});
	}
}

module.exports = {
	Utility
};
