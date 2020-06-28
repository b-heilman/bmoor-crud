
const {Route} = require('./route.js');
const {Context} = require('./context.js');
const {Config} = require('bmoor/src/lib/config.js');

async function formatResponse(res, changes/*, ctx, nexus*/){
	if (changes.length){
		return changes.reduce(
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
		);
	} else {
		return res;
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
				return service.delete(service.schema.getKey(d.to), ctx);
			} else if (d.action === 'update'){
				// if it was updated, roll it back
				return service.update(service.schema.getKey(d.to), d.from, ctx);
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
	constructor(){

	}

	ping(){
		return {ok: true};
	}

	prepareRoute(nexus, method, route, fn, settings={}){
		return new Route(
			method,
			route,
			async (...params) => {
				const ctx = await config.get('buildContext')(params);

				await ctx.isReady();

				try {
					const res = await this[fn](ctx);

					if (settings.formatResponse){
						return settings.formatResponse(res, ctx.getChanges(), ctx, nexus);
					} else {
						return config.get('formatResponse')(res, ctx.getChanges(), ctx, nexus);
					}
				} catch(ex){
					if (settings.enableRollback){
						await config.get('handleRollback')(ctx.getChanges(), ctx, nexus);
					}

					throw ex;
				}
			}
		);
	}

	getRoutes(nexus){
		return [
			this.prepareRoute(nexus, 'get', '', 'ping')
		];
	}
}

module.exports = {
	config,
	handleRollback,
	formatResponse,
	Controller
};
