const {Config} = require('bmoor/src/lib/config.js');
const error = require('bmoor/src/lib/error.js');

const config = new Config({});

const {Controller, parseQuery, parseSettings} = require('../server/controller.js');
const {Composite} = require('../schema/composite.js');
const {Document} = require('../services/document.js');

class Querier extends Controller {
	constructor(nexus) {
		super(null);

		this.nexus = nexus;
	}

	async get(ctx) {
		const type = ctx.getParam('type');
		const name = ctx.getParam('name');

		let view = null;
		if (type === 'document'){
			view = await this.nexus.getDocument(name);
		} else {
			view = await this.nexus.getCrud(name);
		}

		if (ctx.hasQuery()){
			return view.query(
				await parseQuery(view, ctx),
				ctx,
				await parseSettings(view, ctx)
			);
		} else {
			throw error.create('unable to call without query', {
				code: 'QUERY_CONTROLLER_READ_UNAVAILABLE',
				type: 'warn',
				status: 405
			});
		}
	}

	async search(ctx) {
		const composite = new Composite('comp-' + Date.now(), this.nexus);

		await composite.configure(await ctx.getContent());

		const doc = new Document(composite);

		await doc.configure({});
		await doc.build();

		return doc.query(
			await parseQuery(doc, ctx),
			ctx,
			await parseSettings(doc, ctx)
		);
	}

	_buildRoutes() {
		return [
			{
				// search
				route: {
					path: '',
					method: 'post'
				},
				fn: (ctx) => this.search(ctx),
				hidden: false,
				structure: {}
			},
			{
				// get
				route: {
					path: '/:type/:name',
					method: 'get'
				},
				fn: (ctx) => this.get(ctx),
				hidden: false,
				structure: {}
			}
		];
	}
}

module.exports = {
	config,
	Querier
};
