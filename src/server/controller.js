
const {Route} = require('./route.js');
const {Context} = require('./context.js');
const {Config} = require('bmoor/src/lib/config.js');

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

			const service = await nexus.loadService(d.model);

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
	buildContext: function(req){
		return new Context(req);
	},
	formatResponse,
	handleRollback
});

class Controller {
	constructor(structure){
		this.structure = structure;
	}

	async configure(settings){
		this.settings = settings;
	}

	prepareRoute(nexus, settings={}){
		return new Route(
			settings.route.path,
			settings.route.method,
			async (...params) => {
				const ctx = await config.get('buildContext')(params);

				await ctx.isReady();

				try {
					const res = await settings.fn(ctx);
					const changes = ctx.getChanges();

					if (ctx.info.response){
						return ctx.info.response(res, changes, ctx, nexus);
					} else if (settings.formatResponse){
						return settings.formatResponse(res, changes, ctx, nexus);
					} else {
						return config.get('formatResponse')(res, changes, ctx, nexus);
					}
				} catch(ex){
					if (settings.enableRollback){
						await config.get('handleRollback')(ctx.getChanges(), ctx, nexus);
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

	getRoutes(nexus){
		return this._buildRoutes()
		.map(routeInfo => this.prepareRoute(
			nexus, 
			routeInfo
		));
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
	Controller
};
