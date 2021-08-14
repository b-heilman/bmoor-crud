   
const error = require('bmoor/src/lib/error.js');
const {Config} = require('bmoor/src/lib/config.js');

const config = new Config({
});

const {Controller, parseQuery} = require('../server/controller.js');
const {Composite} = require('../schema/composite.js');
const {Document} = require('../services/document.js');

class Querier extends Controller {
	constructor(nexus){
		super(null);

		this.nexus = nexus;
	}

	async query(ctx){
		const [content, query] = await Promise.all([
			ctx.getContent(),
			parseQuery(null, ctx)
		]);

		const composite = new Composite('comp-'+Date.now(), this.nexus);

		await composite.configure(content);

		const doc = new Document(composite);

		await doc.configure({});

		return doc.query(query, ctx);
	}

	_buildRoutes(){
		return [{
			// create
			route: {
				path: '',
				method: 'post'
			}, 
			fn: (ctx) => this.query(ctx),
			hidden: false,
			structure: {}
		}];
	}
}

module.exports = {
	config,
	Querier
};
