
const joiners = {
	and: Symbol('and'),
	or: Symbol('or')
}

class Expression {
	constructor(joiner=joiners.and){
		if (!joiners[joiner]){
			throw new Error('unknown joiner');
		}

		this.joiner = joiner;
		this.expressables = [];
	}

	addExpressable(expressable){
		this.expressables.push(expressable);
	}

	toJSON(){
		return {
			join: this.joiner === joiners.and ? 'and' : 'or',
			expressables: this.expressables.map(exp => exp.toJSON())
		};
	}
}

module.exports = {
	joiners
	Expression
};