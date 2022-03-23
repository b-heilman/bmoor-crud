const {Bootstrap, config: bootConfig} = require('../env/bootstrap.js');
const {Context} = require('./context.js');
const {Cache} = require('./cache.js');

const config = bootConfig.extend({
	hooks: {
		buildContext: (req) =>
			new Context(
				req,
				{
					query: 'query',
					params: 'params',
					method: 'method',
					content: 'body',
					permissions: 'permissions'
				},
				new Cache()
			),
		beforeLoad: async () => null,
		beforeConfigure: async () => null,
		beforeStart: async () => null,
		afterStart: async () => null
	},
	server: {
		buildRouter: function () {
			throw new Error('Define a router factory');
		}
	}
});

function buildRouter(crudRouter, cfg) {
	const router = cfg.get('server.buildRouter')();

	crudRouter.getRouters().forEach((subRouter) => {
		router.use(subRouter.path, buildRouter(subRouter, cfg));
	});

	crudRouter.getRoutes().forEach((route) => {
		router[route.method](route.path, async (req, res) => {
			try {
				const hooks = cfg.get('hooks');

				const ctx = hooks.buildContext(req);

				const rtn = await route.action(ctx);

				res.json(rtn);
			} catch (ex) {
				console.log('-> server failure');
				console.log(ex);

				// TODO: a little more elegant here.  I should have a way
				//   to format errors, right?
				res.status(500);
				res.json({
					message: 'server having a bad day'
				});
			}
		});
	});

	return router;
}

async function configure(cfg, mockery) {
	const hooks = cfg.get('hooks');

	await hooks.beforeLoad();

	const bootstrap = new Bootstrap(cfg);

	await hooks.beforeConfigure();

	await bootstrap.install(mockery);

	return bootstrap;
}

async function build(mount, cfg, mockery = null) {
	const bootstrap = await configure(cfg, mockery);

	const crudRouter = bootstrap.router;

	mount.use(crudRouter.path, buildRouter(crudRouter, cfg));

	return bootstrap;
}

module.exports = {
	config,
	configure,
	build
};
