const {StatementExpression, joiners} = require('./statement/expression.js');

const methods = {
	create: Symbol('create'),
	read: Symbol('read'),
	update: Symbol('update'),
	delete: Symbol('delete')
};

function translateParams(expression) {
	const agg = [];

	// TODO: I don't think I have properly tested ingesting arrays...
	expression.expressables.forEach((exp) => {
		if (exp instanceof StatementExpression) {
			agg.push('(' + translateParams(exp) + ')');
		} else {
			// has to be a param
			agg.push(
				`$${exp.series}.${exp.path} ${exp.operation} ` +
					JSON.stringify(exp.value)
			);
		}
	});

	return agg.join(expression.joiner === joiners.and ? ' & ' : ' | ');
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

class Statement {
	constructor(baseSeries, baseModel = null) {
		this.models = {};

		this.baseSeries = this.getSeries(baseSeries);

		this.filters = new StatementExpression();
		this.params = new StatementExpression();

		if (baseModel) {
			this.setModel(baseSeries, baseModel);
		}
	}

	getInOrder() {
		// we assume the models are already in order
		return Object.values(this.models);
	}

	setMethod(method) {
		if (!Object.values(methods).includes(method)) {
			throw new Error('unknown method');
		}

		this.method = method;

		return this;
	}

	hasSeries(series) {
		return !!this.models[series];
	}

	getNeededSeries() {
		return new Set([...this.filters.getSeries(), ...this.params.getSeries()]);
	}

	getSeries(series) {
		if (!series) {
			throw new Error('unusable series: ' + series);
		}

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

		if (!incoming.model) {
			throw new Error('!!!');
		}

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
		const stmt = new this.constructor(
			this.baseSeries.series,
			this.baseSeries.schema
		);

		stmt.import(this);

		return stmt;
	}

	toRequest() {
		const queryStmts = [];

		if (this.filters.isExpressable()) {
			queryStmts.push(translateParams(this.filters));
		}

		if (this.params.isExpressable()) {
			queryStmts.push(translateParams(this.params));
		}

		const query = queryStmts.length ? queryStmts.join(' & ') : undefined;

		return {query};
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

module.exports = {
	methods,
	reduceExpression,
	Statement
};
