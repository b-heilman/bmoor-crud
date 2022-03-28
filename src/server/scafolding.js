const {Config} = require('bmoor/src/lib/config.js');

const {Bootstrap, config: bootConfig} = require('../env/bootstrap.js');
const {Context} = require('./context.js');
const {Cache} = require('./cache.js');

const hooks = new Config({
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
});

const server = new Config({
	buildRouter: function () {
		throw new Error('Define a router factory');
	}
});

const config = new Config(
	{},
	{
		bootstrap: bootConfig,
		hooks,
		server
	}
);

function buildRouter(crudRouter, cfg) {
	const hooks = cfg.getSub('hooks');
	const router = cfg.getSub('server').get('buildRouter')();

	crudRouter.getRouters().forEach((subRouter) => {
		router.use(subRouter.path, buildRouter(subRouter, cfg));
	});

	crudRouter.getRoutes().forEach((route) => {
		router[route.method](route.path, async (req, res) => {
			try {
				const ctx = hooks.get('buildContext')(req);

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

async function configure(cfg, mockery = {}) {
	const hooks = cfg.getSub('hooks');

	await hooks.get('beforeLoad')();

	const bootstrap = new Bootstrap(cfg.getSub('bootstrap'));

	await hooks.get('beforeConfigure')();

	await bootstrap.install(mockery);

	return bootstrap;
}

async function build(mount, cfg = config, mockery = {}) {
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
