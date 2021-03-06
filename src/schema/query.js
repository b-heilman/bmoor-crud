
class QueryField {
	constructor(path, alias = null){
		this.path = path;
		this.as = alias;
	}
}

class QueryParam {
	/***
	 * values
	 * op
	 * ----
	 * value
	 * op
	 ***/
	constructor(path, value, operation = '=', settings = {}){
		this.path = path;
		this.operation = operation;
		this.value = value;
		this.settings = settings;
	}
}

// TODO: I'm going to assume there's always has to be an on
class QueryJoin {
	constructor(name, mappings, optional = false){
		this.name = name;

		this.mappings = mappings;
		this.optional = optional;
	}

	flip(model){
		return new QueryJoin(
			model,
			this.mappings.map(
				map => ({
					from: map.to,
					to: map.from
				})
			),
			this.optional
		);
	}
}

class QuerySort {
	constructor(series, path, ascending = true){
		this.series = series;
		this.path = path;
		this.ascending = ascending;
	}
}

class QueryPosition {
	constructor(start, limit){
		this.start = start;
		this.limit = limit;
	}
}

class Query {
	constructor(baseModel){
		this.base = baseModel;
		this.models = {};
		this.sorts = null;
		this.position = null;

		this.getModel(baseModel);
	}

	hasSeries(series){
		return !!this.models[series];
	}

	// TODO: I really should call this series because model is a loaded term
	getModel(model){
		let rtn = this.models[model];

		if (!rtn){
			rtn = {
				schema: model,
				fields: [],
				params: [],
				joins: {}
			};

			this.models[model] = rtn;
		}

		return rtn;
	}

	setSchema(model, schema){
		this.getModel(model).schema = schema;

		return this;
	}

	addFields(model, fields){
		this.getModel(model).fields.push(...fields.flat());

		return this;
	}

	addParams(model, params){
		this.getModel(model).params.push(...params.flat());

		return this;
	}

	addJoins(fromModel, joins){
		if (fromModel === this.base){
			joins.map(
				join => this.addJoins(join.name, [join.flip(fromModel)])
			);
		} else {
			const model = this.getModel(fromModel);

			joins.forEach(join => {
				const toModel = join.name;
				const targetModel = this.getModel(toModel);

				if (!(model.joins[toModel] || targetModel.joins[fromModel])){
					model.joins[toModel] = join;
				}
			});
		}

		return this;
	}

	setSorts(sorts){
		this.sorts = sorts;

		return this;
	}

	setPosition(position){
		this.position = position;

		return this;
	}

	getInOrder(){
		const ordered = [];

		let toProcess = Object.keys(this.models)
		.map(series => {
			return {
				series,
				...this.models[series]
			};
		});

		while(toProcess.length){
			const origLength = toProcess.length;
			const names = toProcess.map(model => model.series);

			toProcess = toProcess.filter(link => {
				const c = Object.values(link.joins).filter(
					join => names.indexOf(join.name) !== -1
				).length;

				if (c === 0){
					ordered.push(link);
					
					return false;
				} else {
					return true;
				}
			});

			if (toProcess.length === origLength){
				throw new Error('unable to reduce further');
			}
		}

		return ordered;
	}

	toJSON(){
		const res = this.getInOrder().reduce(
			(agg, model) => {
				const series = model.series;

				agg.models.push({
					series,
					schema: model.schema,
					joins: Object.values(model.joins)
				});

				agg.fields.push(...model.fields.map(
					field => ({
						series,
						path: field.path,
						as: field.as
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
				params: []
			}
		);

		if (this.sort){
			res.sort = this.sort;
		}

		if (this.position){
			res.position = this.position;
		}

		return res;
	}
}

module.exports = {
	QueryField,
	QueryParam,
	QueryJoin,
	QuerySort,
	QueryPosition,
	Query
};
