
class Statement {
	constructor(baseSeries){
		this.base = baseSeries;
		this.models = {};

		this.getSeries(baseSeries);
	}

	hasSeries(series){
		return !!this.models[series];
	}

	getSeries(series){
		let rtn = this.models[series];

		if (!rtn){
			rtn = {
				series,
				schema: series,
				fields: [],
				filters: [],
				params: []
			};

			this.models[series] = rtn;
		}

		return rtn;
	}

	setModel(series, model){
		const target = this.getSeries(series);

		target.model = model;
		target.schema = model.schema;

		return this;
	}

	addFields(series, fields){
		this.getSeries(series).fields.push(...fields.flat());

		return this;
	}

	addFilters(series, filters){
		this.getSeries(series).filters.push(...filters.flat());

		return this;
	}

	addParams(series, params){
		this.getSeries(series).params.push(...params.flat());

		return this;
	}

	importSeries(series, statement){
		const incoming = statement.getSeries(series);

		this.setModel(series, incoming.model)
			.addFields(series, incoming.fields)
			.addFilters(series, incoming.filters)
			.addParams(series, incoming.params);

		return incoming;
	}

	import(statement){
		// I am not worrying about collisions here.  If I ever use this in
		// that situation, I will need to put a more complex solution in here
		Object.keys(statement.models).forEach(series => {
			this.importSeries(series, statement);
		});
	}

	clone(){
		const stmt = new this.constructor(this.base);

		stmt.import(this);

		return stmt;
	}

	toJSON(){
		return Object.values(this.models).reduce(
			(agg, model) => {
				const series = model.series;

				agg.models.push({
					series,
					schema: model.schema
				});

				agg.fields.push(...model.fields.map(
					field => ({
						series,
						path: field.path,
						as: field.as
					})
				));

				// We separate the two, the thought is that filters are defined
				// by the base query and params are added dynamically
				agg.filters.push(...model.filters.map(
					param => ({
						series,
						path: param.path,
						operation: param.operation,
						value: param.value,
						settings: param.settings
					})
				));

				agg.params.push(...model.params.map(
					param => ({
						series,
						path: param.path,
						operation: param.operation,
						value: param.value,
						settings: param.settings
					})
				));

				return agg;
			},
			{
				models: [],
				fields: [],
				filters: [],
				params: []
			}
		);
	}
}

module.exports = {
	Statement
};
