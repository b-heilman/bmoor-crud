const {Statement, methods} = require('../statement.js');

class QueryStatement extends Statement {
	constructor(baseSeries) {
		super(baseSeries);

		this.position = null;

		this.setMethod(methods.read);
	}

	getSeries(series) {
		const rtn = super.getSeries(series);

		if (!rtn.joins) {
			rtn.joins = {};
			rtn.sorts = [];
			rtn.links = {};
		}

		return rtn;
	}

	addParams(series, params) {
		if (params.length) {
			this.hasParams = true;
		}

		return super.addParams(series, params);
	}

	addJoins(series, joins) {
		if (series === this.base) {
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

	addSorts(series, sorts) {
		this.getSeries(series).sorts.push(...sorts.flat());

		return this;
	}

	importSeries(series, statement) {
		const incoming = super.importSeries(series, statement);

		this.addJoins(series, Object.values(incoming.joins)).addSorts(
			series,
			incoming.sorts
		);

		return incoming;
	}

	setPosition(position) {
		this.position = position;

		return this;
	}

	getInOrder() {
		const ordered = [];

		// if a statement is used, which two different sources, I want the source
		// with parameters to be run first.
		if (this.hasParams && !this.models[this.base].params.length) {
			const targetSource = this.models[this.base].model.incomingSettings.source;
			let sameSource = false;
			let betterSeries = null;

			Object.keys(this.models).forEach((series) => {
				const info = this.models[series];
				if (info.params.length) {
					if (info.model.incomingSettings.source === targetSource) {
						sameSource = true;
					} else if (!betterSeries) {
						betterSeries = series;
					}
				}
			});

			if (!sameSource) {
				if (betterSeries) {
					this.base = betterSeries;
				} else {
					console.log(this.models);
					throw new Error('well, this is bad');
				}
			}
		}

		let toProcess = Object.values(this.models);

		const extraRoots = toProcess.filter(
			(link) => !Object.values(link.joins).length && link.series !== this.base
		);

		if (extraRoots.length) {
			// we can only have one table without links, and that is the base
			// so steal links from other nodes
			extraRoots.forEach((extraLink) => {
				while (
					!Object.values(extraLink.joins).length &&
					extraLink.series !== this.base
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

	toJSON() {
		let sorts = [];

		const res = this.getInOrder().reduce(
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

				// We separate the two, the thought is that filters are defined
				// by the base query and params are added dynamically
				agg.filters.push(
					...model.filters.map((filter) => ({
						series,
						...filter
					}))
				);

				agg.params.push(
					...model.params.map((param) => ({
						series,
						...param
					}))
				);

				sorts = sorts.concat(
					model.sorts.map((sort) => ({
						series,
						...sort
					}))
				);

				return agg;
			},
			{
				method: 'read',
				models: [],
				fields: [],
				filters: [],
				params: []
			}
		);

		if (sorts.length) {
			res.sorts = sorts.sort((a, b) => a.pos - b.pos);
		}

		if (this.position) {
			res.position = this.position;
		}

		return res;
	}
}

module.exports = {
	QueryStatement
};
