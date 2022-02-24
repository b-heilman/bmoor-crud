const joiners = {
	and: Symbol('and'),
	or: Symbol('or')
};

function calculateExpressionSet(expression, set) {
	expression.expressables.forEach((exp) => {
		if (exp instanceof StatementExpression) {
			calculateExpressionSet(exp, set);
		} else {
			// this is a variables
			set.add(exp.series);
		}
	});
}

function validateExpression(expression, verify) {
	expression.expressables.forEach((exp) => {
		if (exp instanceof StatementExpression) {
			validateExpression(exp, verify);
		} else {
			// this is a variables
			verify(exp.series, exp.path);
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

	isExpressable() {
		return this.expressables.length !== 0;
	}

	addExpressable(expressable) {
		this.expressables.push(expressable);
	}

	getSeries() {
		const set = new Set();

		calculateExpressionSet(this, set);

		return set;
	}

	validate(verify) {
		validateExpression(this, verify);

		return true;
	}

	// this is joined to join in another expression.  It's so that a caculated expression
	// that is and based can easily be joined on a lowest level
	join(expression) {
		if (this.joiner === expression.joiner) {
			this.expressables.push(...expression.expressables);
		} else {
			this.expressables.push(expression);
		}
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
