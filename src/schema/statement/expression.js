const joiners = {
	and: Symbol('and'),
	or: Symbol('or')
};

function calculateExpressionSet(expression, set){
	expression.expressables.forEach((exp) => {
		if (exp instanceof StatementExpression){
			calculateExpressionSet(exp, set);
		} else { // this is a variables
			set.add(exp.series);
		}
	});
}

class StatementExpression {
	constructor(expressables = []) {
		this.joiner = joiners.and;
		this.expressables = expressables;
	}

	setJoin(joiner) {
		this.joiner = joiner;
	}

	addExpressable(expressable) {
		this.expressables.push(expressable);
	}

	getSeries(){
		const set = new Set();

		calculateExpressionSet(this, set);

		return set;
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
