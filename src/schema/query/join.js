
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

module.exports = {
	QueryJoin
};
