
const error = require('bmoor/src/lib/error.js');

const {Controller} = require('../server/controller.js');

class Document extends Controller {
	constructor(composite, settings){
		super();
		
		this.composite = composite;
		this.settings = settings;
	}

	async route(ctx){
		if (ctx.getMethod() === 'post'){
			if (!this.settings.writable){
				throw error.create('document is not writable', {
					code: 'DOCUMENT_CONTROLLER_WRITE_UNAVAILABLE',
					type: 'warn',
					status: 400
				});
			}

			if (this.settings.write && !ctx.hasPermission(this.settings.write)){
				throw error.create('not allowed to write to document', {
					code: 'DOCUMENT_CONTROLLER_WRITE_PERMISSION',
					type: 'warn',
					status: 405
				});
			}

			return this.composite.push(await ctx.getContent(), ctx);
		} else if (ctx.getMethod() === 'get') {
			if (!this.settings.readable){
				throw error.create('document is not readable', {
					code: 'DOCUMENT_CONTROLLER_READ_UNAVAILABLE',
					type: 'warn',
					status: 400
				});
			}

			if (this.settings.read && !ctx.hasPermission(this.settings.read)){
				throw error.create('not allowed to read from document', {
					code: 'DOCUMENT_CONTROLLER_READ_PERMISSION',
					type: 'warn',
					status: 405
				});
			}

			if (ctx.hasParam('id')) {
				return this.composite.read(ctx.getParam('id'), ctx);
			} else {
				return this.composite.query(ctx.getQuery(), ctx);
			}
		} else {
			throw error.create('called read with method '+ctx.method, {
				code: 'DOCUMENT_CONTROLLER_UNAVAILABLE',
				type: 'warn',
				status: 405
			});
		}
	}

	getRoutes(nexus){
		const run = this.route.bind(this);

		return [
			this.prepareRoute(nexus, 'post', '/', run),

			this.prepareRoute(nexus, 'get','/:id', run),
			
			this.prepareRoute(nexus, 'get', '/', run)
		];
	}
}

module.exports = {
	Document
};
