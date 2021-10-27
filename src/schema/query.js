
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
	constructor(baseSeries){
		this.base = baseSeries;
		this.models = {};
		this.sorts = null;
		this.position = null;

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
				params: [],
				joins: {},
				links: {}
			};

			this.models[series] = rtn;
		}

		return rtn;
	}

	setSchema(series, schema){
		this.getSeries(series).schema = schema;

		return this;
	}

	addFields(series, fields){
		this.getSeries(series).fields.push(...fields.flat());

		return this;
	}

	addParams(series, params){
		this.getSeries(series).params.push(...params.flat());

		return this;
	}

	addJoins(fromModel, joins){
		if (fromModel === this.base){
			joins.map(
				join => this.addJoins(join.name, [join.flip(fromModel)])
			);
		} else {
			const series = this.getSeries(fromModel);

			joins.forEach(join => {
				const toModel = join.name;
				const targetModel = this.getSeries(toModel);

				if (!(series.joins[toModel] || targetModel.joins[fromModel])){
					series.joins[toModel] = join;
					targetModel.links[fromModel] = join.flip(fromModel);
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

		let toProcess = Object.values(this.models);
		const extraRoots = toProcess.filter(
			link => !Object.values(link.joins).length && link.series !== this.base
		);

		if (extraRoots.length){
			// we can only have one table without links, and that is the base 
			// so steal links from other nodes
			extraRoots.forEach(extraLink => {
				while(!Object.values(extraLink.joins).length){
					const join = Object.values(extraLink.links)[0];

					extraLink.joins[join.name] = join;

					const otherSeries = this.getSeries(join.name);

					delete otherSeries.joins[extraLink.series];

					extraLink = otherSeries;
				}
			});
		}

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

		if (this.sorts){
			res.sorts = this.sorts;
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
