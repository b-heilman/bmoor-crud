const {Config} = require('bmoor/src/lib/config.js');

const config = new Config({});

const {Controller, parseQuery} = require('../server/controller.js');
const {Composite} = require('../schema/composite.js');
const {Document} = require('../services/document.js');

class Querier extends Controller {
	constructor(nexus) {
		super(null);

		this.nexus = nexus;
	}

	async search(ctx) {
		const [content, settings] = await Promise.all([
			ctx.getContent(),
			parseQuery(ctx)
		]);

		const composite = new Composite('comp-' + Date.now(), this.nexus);

		await composite.configure(content);

		const doc = new Document(composite);

		await doc.configure({});
		await doc.build();

		return doc.query(settings, ctx);
	}

	_buildRoutes() {
		return [
			{
				// create
				route: {
					path: '',
					method: 'post'
				},
				fn: (ctx) => this.search(ctx),
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
