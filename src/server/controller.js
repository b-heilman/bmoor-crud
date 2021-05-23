
const {Route} = require('./route.js');
const {Router} = require('./router.js');
const {Config} = require('bmoor/src/lib/config.js');

async function parseQuery(view, ctx){
	const sort = ctx.getQuery('sort') || null;
	const joins = ctx.getQuery('join') || [];
	const limit = ctx.getQuery('limit') || null;
	const params = ctx.getQuery('filter') || {};

	// ? param[name]=hello & param[foo.bar][gt]=123
	// ? join[$foo.id > $world] = 12 & join[$hello.name > @worldId$world] = woof
	// ? sort=-$foo.name,+bar
	// ? limit=100
	// TODO: pagination?
	return {
		params: await view.structure.clean('query', params, ctx),
		joins,
		sort,
		position: {limit}
	};
}

async function formatResponse(res, changes/*, ctx, nexus*/){
	if (changes.length){
		return {
			result: res,
			changes: changes.reduce(
				function(agg, change){
					if (!change.md.internal){
						let modelInfo = agg[change.model];

						if (!modelInfo){
							modelInfo = [];

							agg[change.model] = modelInfo;
						}

						modelInfo.push({
							action: change.action,
							datum: change.to || change.from
						});
					}

					return agg;
				},
				{}
			)
		};
	} else {
		return {
			result: res
		};
	}
}

async function handleRollback(changes, ctx, nexus){
	ctx.trackChanges(false);

	await changes.reverse()
	.reduce(
		async (prom, d) => {
			await prom;

			const service = await nexus.loadCrud(d.model);

			if (d.action === 'create'){
				// if it was created, just delete it
				return service.delete(d.key, ctx);
			} else if (d.action === 'update'){
				// if it was updated, roll it back
				return service.update(d.key, d.from, ctx);
			} else if (d.action === 'delete'){
				// I don't know what to do here, because anything created that 
				// links back to this is gonna need updated.  That causes a whole
				// slew of issues.  So for now, I'm not supporting restoring deleted
				// data.
			}
		},
		null
	);

	ctx.trackChanges(true);
}

const config = new Config({
	formatResponse,
	handleRollback
});

class Controller {
	constructor(view){
		this.view = view;
	}

	async configure(settings){
		this.incomingSettings = settings;
	}

	prepareRoute(settings={}){
		return new Route(
			settings.route.path,
			settings.route.method,
			async (ctx) => {
				await ctx.isReady();

				try {
					const res = await settings.fn(ctx);
					const changes = ctx.getChanges();

					if (ctx.info.response){
						return ctx.info.response(res, changes, ctx);
					} else if (settings.formatResponse){
						return settings.formatResponse(res, changes, ctx);
					} else {
						return config.get('formatResponse')(res, changes, ctx);
					}
				} catch(ex){
					if (settings.enableRollback){
						await config.get('handleRollback')(ctx.getChanges(), ctx, this.view.structure.nexus);
					}

					throw ex;
				}
			},
			settings
		);
	}

	_buildRoutes(){
		return [{
			route: {
				path: '',
				method: 'get'
			},
			fn: () => {
				return {ok: true};
			}
		}];
	}

	getRoutes(){
		return this._buildRoutes()
		.map(routeInfo => this.prepareRoute(routeInfo));
	}

	getRouter(){
		const router = new Router('/'+this.view.structure.name);

		router.addRoutes(this.getRoutes());

		return router;
	}

	toJSON(){
		return {
			$schema: 'bmoor-crud:controller',
			routes: this._buildRoutes()
			.filter(routeInfo => !routeInfo.hidden)
			.map(
				routeInfo => ({
					route: routeInfo.route,
					structure: routeInfo.structure.name
				})
			)
		};
	}
}

module.exports = {
	config,
	handleRollback,
	formatResponse,
	parseQuery,
	Controller
};
