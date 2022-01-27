const joiners = {
	and: Symbol('and'),
	or: Symbol('or')
};

class StatementExpression {
	constructor() {
		this.joiner = joiners.and;
		this.expressables = [];
	}

	setJoin(joiner) {
		this.joiner = joiner;
	}

	addExpressable(expressable) {
		this.expressables.push(expressable);
	}

	clone() {
		const rtn = new StatementExpression();

		rtn.setJoin(this.joiner);

		rtn.expressables = this.expressables.slice(0);

		return rtn;
	}

	toJSON() {
		return {
			join: this.joiner === joiners.and ? 'and' : 'or',
			expressables: this.expressables.map((exp) => exp.toJSON())
		};
	}
}

module.exports = {
	joiners,
	StatementExpression
};
