const {StatementExpression} = require('../schema/statement/expression.js');
const {StatementVariable} = require('../schema/statement/variable.js');
const {Queriable} = require('../schema/query/queriable.js');

function canExecute(statement, datum) {
	let ok = true;

	const checks = statement.externals.flatMap(({mappings}) =>
		mappings.map((mapping) => mapping.from)
	);

	for (let i = 0, c = checks.length; i < c && ok; i++) {
		ok = checks[i] in datum;
	}

	return ok;
}

function combine(arr) {
	const set = arr.shift();

	if (arr.length) {
		const sub = combine(arr);

		return sub.flatMap((datum) =>
			set.map((myDatum) => {
				return Object.assign({}, datum, myDatum);
			})
		);
	} else {
		return set;
	}
}

async function executeQueriable(querier, queriable, ctx) {
	const source = querier.sources[queriable.name];

	return source.execute(queriable, ctx);
}

async function runQueriable(querier, settings, queriable, ctx) {
	if (settings.cacheable) {
		const series = 'querier:' + querier.name;
		const key = queriable.getIdentifier();
		const check = ctx.hasCache(series, key);

		if (check) {
			return ctx.getCache(series, key);
		} else {
			return ctx.promiseCache(
				series,
				key,
				executeQueriable(querier, queriable, ctx)
			);
		}
	} else {
		return executeQueriable(querier, queriable, ctx);
	}
}

async function processDatum(querier, settings, stmts, datum, ctx) {
	const res = await Promise.all(
		stmts.map(async (stmt) => {
			const queriable = stmt.queriable.clone();

			// TODO: process the externals
			stmt.externals.forEach(({name, mappings}) =>
				mappings.map((mapping) =>
					queriable.addParam(
						new StatementVariable(name, mapping.to, datum[mapping.from], '=')
					)
				)
			);

			return runQueriable(querier, settings, queriable, ctx);
		})
	);

	res.push([datum]);

	return combine(res);
}

async function processStatements(querier, settings, stmts, datums, ctx) {
	return (
		await Promise.all(
			datums.map(async (datum) =>
				processDatum(querier, settings, stmts, datum, ctx)
			)
		)
	).flat();
}

function buildExpressableSwitch(sourceDex, seriesToSource, method) {
	return function (filter) {
		// if expression, expression.getSeries() > make sure all same source
		let name = null;
		let source = null;
			
		if (filter instanceof StatementExpression) {
			const series = filter.getSeries();
			const sources = {};
			for (let seriesName of series) {
				sources[seriesToSource[seriesName]] = true;
			}

			const names = Object.keys(sources);
			if (names.length > 1) {
				throw new Error('Expression with mixed sources');
			} else {
				name = names[0];
				source = sourceDex[name];
			}
		} else {
			name = seriesToSource[filter.series];

			if (!name){
				const available = Object.keys(seriesToSource).join();
				throw new Error('Unknown series: '+filter.series+' ('+available+')');
			}

			source = sourceDex[name];
		}

		if (source){
			source.queriable[method](filter);
		} else {
			const available = Object.keys(sourceDex).join();
			throw new Error('Unknown source: '+name+' ('+available+')');
		}
	};
}

class Querier {
	constructor(name, query) {
		this.name = name;

		const seriesToSource = {};

		let tempCount = 0;

		const sourceDex = query.getInOrder().reduce((agg, info) => {
			const series = info.series;
			const sourceName = info.model.incomingSettings.source;

			seriesToSource[series] = sourceName;
			// The thing I know is series always join left here.  So
			// I am able to figure out of the join is internal or external
			let order = 0;
			const joins = Object.values(info.joins).reduce(
				(joins, join) => {
					const otherSeries = join.name;
					const otherSource = seriesToSource[otherSeries];
					const other = agg[otherSource];

					// if the other series uses the same source...
					if (otherSource === sourceName) {
						joins.internal.push(join);
					} else {
						const otherOrder = other.order;
						if (order <= otherOrder) {
							order = otherOrder + 1;
						}

						const mappings = join.mappings.map((mapping) => {
							// We need to check to see if the joining field has been added to the
							// query.  If not, it has to be added to the other query so we can
							// reference it here.
							let temp = false;
							let fieldAs = other.queriable.getField(join.name, mapping.to);

							if (!fieldAs) {
								fieldAs = other.queriable.addTempField(
									join.name,
									'exe_' + tempCount++,
									mapping.to
								);
								temp = true;
							}

							return {
								from: fieldAs,
								to: mapping.from,
								temp
							};
						});

						joins.external.push({
							name: series,
							mappings
						});
					}

					return joins;
				},
				{
					internal: [],
					external: []
				}
			);

			let queriable = null;
			let statement = agg[sourceName];
			if (statement) {
				queriable = statement.queriable;
			} else {
				// these should all be in order, so the first series should be the
				// base series
				queriable = new Queriable(
					'fragment-' + Object.keys(agg).length,
					series
				);

				statement = {
					queriable,
					externals: [],
					order
				};
				agg[sourceName] = statement;
			}

			queriable.setModel(series, info.model);

			joins.external.forEach((join) => {
				statement.externals.push(join);
			});

			queriable.addJoins(series, joins.internal);

			queriable.addFields(series, info.fields);

			return agg;
		}, {});

		// TODO: I still need to solve for expression
		// TODO: consolidate filter and param to be variable, but use those
		//   properties still in statement
		query.filters.expressables.forEach(
			buildExpressableSwitch(sourceDex, seriesToSource, 'addFilter')
		);

		query.params.expressables.forEach(
			buildExpressableSwitch(sourceDex, seriesToSource, 'addParam')
		);

		// incoming sorts are in order, so it's expected the order will
		// be maintained when passed to sub queries this way
		query.sorts.forEach((sort) => {
			sourceDex[seriesToSource[sort.series]].queriable.addSort(sort);
		});

		this.statements = Object.values(sourceDex);

		if (this.position) {
			// first source should always be the root
			this.statements[0].queriable.setPosition(this.position);
		}
	}

	async link(nexus) {
		const sources = {};

		await Promise.all(
			this.statements.map(async (stmt) => {
				sources[stmt.queriable.name] = await nexus.loadSource(
					stmt.queriable.sourceName
				);
			})
		);

		this.sources = sources;
	}

	async run(ctx, settings = {}) {
		let rtn = [{}];
		const stmts = this.statements.slice(0);

		if (stmts.length > 1) {
			while (stmts.length) {
				let toCall = [];
				let current = rtn[0];

				const check = stmts.length;
				while (stmts.length && canExecute(stmts[0], current)) {
					toCall.push(stmts.shift());
				}

				if (stmts.length === check) {
					// TODO: can I say what is missing?
					throw new Error('TODO: no way to reduce?');
				}

				// loop through all the datums
				rtn = await processStatements(this, settings, toCall, rtn, ctx);
			}
		} else {
			// optmized for one source
			rtn = runQueriable(this, settings, stmts[0].queriable, ctx);
		}

		return rtn;
	}

	toJSON() {
		return this.statements.map((stmt) => {
			const exe = stmt.queriable.toJSON();

			exe.externals = stmt.externals;

			return exe;
		});
	}
}

module.exports = {
	Querier
};
