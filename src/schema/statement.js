const {StatementExpression} = require('./statement/expression.js');

const methods = {
	create: Symbol('create'),
	read: Symbol('read'),
	update: Symbol('update'),
	delete: Symbol('delete')
};

class Statement {
	constructor(baseSeries) {
		this.base = baseSeries;
		this.models = {};
		this.filters = new StatementExpression();
		this.params = new StatementExpression();

		this.getSeries(baseSeries);
	}

	setMethod(method) {
		if (!Object.values(methods).includes(method)) {
			throw new Error('unknown method');
		}

		this.method = method;
	}

	hasSeries(series) {
		return !!this.models[series];
	}

	getSeries(series) {
		let rtn = this.models[series];

		if (!rtn) {
			rtn = {
				series,
				schema: series,
				fields: []
			};

			this.models[series] = rtn;
		}

		return rtn;
	}

	setModel(series, model) {
		const target = this.getSeries(series);

		target.model = model;
		target.schema = model.schema;

		return this;
	}

	addFields(series, fields) {
		this.getSeries(series).fields.push(...fields.flat());

		return this;
	}

	addFilter(filter) {
		this.filters.addExpressable(filter);

		return this;
	}

	addParam(param) {
		this.params.addExpressable(param);

		return this;
	}

	importSeries(series, statement) {
		const incoming = statement.getSeries(series);

		this.setModel(series, incoming.model).addFields(series, incoming.fields);

		return incoming;
	}

	import(statement) {
		// I am not worrying about collisions here.  If I ever use this in
		// that situation, I will need to put a more complex solution in here
		Object.keys(statement.models).forEach((series) => {
			this.importSeries(series, statement);
		});

		statement.filters.expressables.forEach((filter) => {
			this.addFilter(filter);
		});

		statement.params.expressables.forEach((param) => {
			this.addParam(param);
		});
	}

	clone() {
		const stmt = new this.constructor(this.base);

		stmt.import(this);

		return stmt;
	}

	toJSON() {
		return Object.values(this.models).reduce(
			(agg, model) => {
				const series = model.series;

				agg.models.push({
					series,
					schema: model.schema
				});

				agg.fields.push(
					...model.fields.map((field) => ({
						series,
						path: field.path,
						as: field.as
					}))
				);

				return agg;
			},
			{
				models: [],
				fields: [],
				filters: this.filters.toJSON(),
				params: this.params.toJSON()
			}
		);
	}
}

function reduceExpression(expression, paramDex = {}) {
	return expression.expressables.reduce((agg, exp) => {
		if (exp instanceof StatementExpression) {
			reduceExpression(exp, agg);
		} else {
			if (agg[exp.series]) {
				agg[exp.series]++;
			} else {
				agg[exp.series] = 1;
			}
		}

		return agg;
	}, paramDex);
}

module.exports = {
	methods,
	reduceExpression,
	Statement
};
