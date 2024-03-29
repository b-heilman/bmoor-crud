const {set} = require('bmoor/src/core.js');

const {Statement, methods, reduceExpression} = require('../statement.js');

class QueryStatement extends Statement {
	constructor(baseSeries, baseSchema = null) {
		super(baseSeries, baseSchema);

		this.position = null;
		this.sorts = [];

		this.setMethod(methods.read);
	}

	getSeries(series) {
		const rtn = super.getSeries(series);

		if (!rtn.joins) {
			rtn.joins = {};
			rtn.links = {};
		}

		return rtn;
	}

	addFilterExpression(expression) {
		return this.filters.join(expression);
	}

	addParam(param) {
		this.hasParams = true;

		return super.addParam(param);
	}

	addParamExpression(expression) {
		this.hasParams = true;

		return this.params.join(expression);
	}

	addJoins(series, joins) {
		if (series === this.baseSeries.series) {
			joins.map((join) => this.addJoins(join.name, [join.flip(series)]));
		} else {
			const seriesInfo = this.getSeries(series);

			joins.forEach((join) => {
				const toSeries = join.name;
				const targetModel = this.getSeries(toSeries);

				if (!(seriesInfo.joins[toSeries] || targetModel.joins[series])) {
					seriesInfo.joins[toSeries] = join;
					targetModel.links[series] = join.flip(series);
				}
			});
		}

		return this;
	}

	addSort(sort) {
		this.sorts.push(sort);

		return this;
	}

	importSeries(series, statement) {
		const incoming = super.importSeries(series, statement);

		this.addJoins(series, Object.values(incoming.joins));

		return incoming;
	}

	import(statement) {
		super.import(statement);

		statement.sorts.forEach((sort) => {
			this.addSort(sort);
		});
	}

	setPosition(position) {
		this.position = position;

		return this;
	}

	getInOrder() {
		const ordered = [];

		// if a statement is used, which two different sources, I want the source
		// with parameters to be run first.
		const paramDex = reduceExpression(this.params);

		if (this.hasParams && !paramDex[this.baseSeries.series]) {
			const targetSource = this.baseSeries.model.incomingSettings.source;
			let sameSource = false;
			let betterSeries = null;

			Object.keys(this.models).forEach((series) => {
				const info = this.models[series];
				if (paramDex[series]) {
					if (info.model.incomingSettings.source === targetSource) {
						sameSource = true;
					} else if (!betterSeries) {
						betterSeries = series;
					}
				}
			});

			if (!sameSource) {
				if (betterSeries) {
					this.baseSeries = this.getSeries(betterSeries);
				} else {
					throw new Error('well, this is bad');
				}
			}
		}

		let toProcess = Object.values(this.models);
		const extraRoots = toProcess.filter(
			(link) =>
				!Object.values(link.joins).length &&
				link.series !== this.baseSeries.series
		);

		if (extraRoots.length) {
			// we can only have one table without links, and that is the base
			// so steal links from other nodes
			extraRoots.forEach((extraLink) => {
				while (
					!Object.values(extraLink.joins).length &&
					extraLink.series !== this.baseSeries.series
				) {
					const join = Object.values(extraLink.links)[0];
					extraLink.joins[join.name] = join;

					const otherSeries = this.getSeries(join.name);

					delete otherSeries.joins[extraLink.series];

					extraLink = otherSeries;
				}
			});
		}

		while (toProcess.length) {
			const origLength = toProcess.length;
			const names = toProcess.map((model) => model.series);

			toProcess = toProcess.filter((link) => {
				const c = Object.values(link.joins).filter(
					(join) => names.indexOf(join.name) !== -1
				).length;

				if (c === 0) {
					ordered.push(link);

					return false;
				} else {
					return true;
				}
			});

			if (toProcess.length === origLength) {
				throw new Error('unable to reduce further');
			}
		}

		return ordered;
	}

	toRequest() {
		const models = this.getInOrder();
		const base = models[0];

		return models.reduce(
			(agg, model) => {
				if (model !== base) {
					agg.joins.push(
						...Object.values(model.joins).map((join) => {
							const on = join.mappings[0];

							const target = `.${on.from}$${model.series}:${model.schema}`;

							return `$${join.name}.${on.to} > ${target}`;
						})
					);
				}

				return agg;
			},
			{
				base: base.schema,
				alias: base.series,
				...super.toRequest(),
				fields: Object.values(this.models).reduce((agg, model) => {
					model.fields.forEach((field) => {
						set(agg, field.as || field.path, `$${model.series}.${field.path}`);
					});

					return agg;
				}, {}),
				joins: []
			}
		);
	}

	toJSON() {
		const rtn = this.getInOrder().reduce(
			(agg, model) => {
				const series = model.series;

				agg.models.push({
					series,
					schema: model.schema,
					joins: Object.values(model.joins)
				});

				agg.fields.push(
					...model.fields.map((field) => ({
						series,
						...field
					}))
				);

				return agg;
			},
			{
				method: 'read',
				models: [],
				fields: [],
				filters: this.filters.toJSON(),
				params: this.params.toJSON()
			}
		);

		// order does matter, order is set
		if (this.sorts.length) {
			rtn.sorts = this.sorts.map((sort) => sort.toJSON());
		}

		if (this.position) {
			rtn.position = this.position;
		}

		return rtn;
	}
}

module.exports = {
	QueryStatement
};
