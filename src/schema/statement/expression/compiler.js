const {Config, ConfigObject} = require('bmoor/src/lib/config.js');

const {Token} = require('bmoor-data/src/expression/Token.js');
const {Compound} = require('bmoor-data/src/expression/Compound.js');
const {Compiler} = require('bmoor-data/src/expression/Compiler.js');

const {StatementExpression, joiners} = require('../expression.js');
const {StatementVariable} = require('../variable.js');

const isDigit = /\d/;
const isSafe = /[A-Za-z_0-9-]/;
const isVariable = /[A-Za-z_0-9]/;
const isQuote = /"|'|`/;
const isOperator = /\+|-|\*|\/|\^|\||&|=|~|<|>|!/;

const escapeChar = '\\';

const parsings = new Config({
	// $foo, $bar,
	reference: new ConfigObject({
		open: function (master, pos) {
			if (master[pos] === '$') {
				return {
					pos: pos + 1,
					begin: pos + 1
				};
			}
		},
		close: function (master, pos, state) {
			const ch = master[pos];

			if (isSafe.test(ch)) {
				return false;
			}

			if (ch === ':') {
				state.series = true;
				return false;
			}

			return {
				pos,
				end: pos - 1
			};
		},
		toToken: function (content, state) {
			let model = content;
			let series = null;

			if (state.series) {
				[series, model] = content.split(':');
			}

			return new Token('reference', model, {series});
		}
	}),

	// .path
	accessor: new ConfigObject({
		open: function (master, pos) {
			if (master[pos] === '.') {
				return {
					pos: pos + 1,
					begin: pos + 1
				};
			}
		},
		close: function (master, pos) {
			const ch = master[pos];

			if (isSafe.test(ch)) {
				return false;
			}

			return {
				pos,
				end: pos - 1
			};
		},
		toToken: function (content) {
			return new Token('accessor', content);
		}
	}),

	block: new ConfigObject({
		open: function (master, pos, state) {
			const ch = master[pos];

			if (ch === '(') {
				state.count = 1;
				state.open = ch;
				state.close = ')';

				return {
					pos: pos + 1,
					begin: pos + 1
				};
			}
		},
		close: function (master, pos, state) {
			const ch = master[pos];

			if (ch === state.open) {
				state.count = state.count + 1;
			} else if (ch === state.close) {
				state.count = state.count - 1;

				if (state.count === 0) {
					return {
						pos: pos + 1,
						end: pos - 1
					};
				}
			}
		},
		toToken: function (content) {
			return new Token('block', content);
		}
	}),

	number: new ConfigObject({
		open: function (master, pos) {
			const ch = master[pos];

			if (isDigit.test(ch)) {
				return {
					pos: pos + 1,
					begin: pos
				};
			}
		},
		close: function (master, pos, state) {
			const ch = master[pos];

			if (isDigit.test(ch)) {
				return null;
			}

			if (ch === '.') {
				state.isFloat = true;
				return null;
			}

			return {
				pos: pos,
				end: pos - 1
			};
		},
		toToken: function (content, state) {
			content = state.isFloat ? parseFloat(content) : parseInt(content);

			return new Token('constant', content, {subtype: 'number'});
		}
	}),

	string: new ConfigObject({
		open: function (master, pos, state) {
			const ch = master[pos];

			if (state.last !== escapeChar && isQuote.test(ch)) {
				state.quote = ch;

				return {
					pos: pos + 2,
					begin: pos + 1
				};
			}
		},
		close: function (master, pos, state) {
			const ch = master[pos];

			if (ch === state.quote && state.last !== escapeChar) {
				return {
					pos: pos + 1,
					end: pos - 1
				};
			}

			return null;
		},
		toToken: function (content, state) {
			const escape =
				escapeChar === '\\' ? '\\\\' + state.quote : escapeChar + state.quote;

			content = content.replace(new RegExp(escape, 'g'), state.quote);

			return new Token('constant', content, {subtype: 'string'});
		}
	}),

	array: new ConfigObject({
		open: function (master, pos) {
			const ch = master[pos];

			if (ch === '[') {
				return {
					pos: pos + 1,
					begin: pos
				};
			}
		},
		close: function (master, pos) {
			const ch = master[pos];

			if (ch === ']' && master[pos - 1] !== '\\') {
				return {
					pos: pos + 1,
					end: pos
				};
			}
		},
		toToken: function (content) {
			return new Token('constant', JSON.parse(content), {subtype: 'array'});
		}
	}),

	operation: new ConfigObject({
		// +
		open: function (master, pos) {
			const ch = master[pos];

			if (isOperator.test(ch)) {
				return {
					pos: pos + 1,
					begin: pos
				};
			}
		},
		close: function (master, pos) {
			const ch = master[pos];

			if (!isOperator.test(ch)) {
				return {
					pos: pos,
					end: pos - 1
				};
			}
		},
		toToken: function (content) {
			return new Token('operation', content);
		}
	}),

	variable: new ConfigObject({
		open: function (master, pos) {
			if (isVariable.test(master[pos])) {
				return {
					pos: pos + 1,
					begin: pos
				};
			}
		},
		close: function (master, pos) {
			const ch = master[pos];

			if (isVariable.test(ch)) {
				return false;
			}

			return {
				pos,
				end: pos - 1
			};
		},
		toToken: function (content) {
			const lowerCase = content.toLowerCase();

			if (lowerCase === 'true') {
				return new Token('constant', true, {subtype: 'boolean'});
			} else if (lowerCase === 'false') {
				return new Token('constant', false, {subtype: 'boolean'});
			} else {
				return new Token('constant', undefined, {subtype: 'undefined'});
			}
		}
	})
});

const composites = new Config({
	compareRight: new ConfigObject({
		tokens: ['reference', 'accessor', 'operation', 'constant'],
		factory: function (tokens) {
			return new Compound(
				'exp',
				new StatementVariable(
					tokens[0].value,
					tokens[1].value,
					tokens[3].value,
					tokens[2].value
				)
			);
		}
	}),
	compareLeft: new ConfigObject({
		tokens: ['constant', 'operation', 'reference', 'accessor'],
		factory: function (tokens) {
			return new Compound(
				'exp',
				new StatementVariable(
					tokens[2].value,
					tokens[3].value,
					tokens[0].value,
					tokens[1].value
				)
			);
		}
	})
});

const expressions = null;

const compiler = new Compiler(parsings, expressions, composites);

function buildExpression(str) {
	str = str.replace(/[\s]/g, ''); // remove all white space

	const tokens = compiler.tokenize(str)[0].tokens;

	let hasAnd = false;
	const sets = tokens.reduce(
		(agg, token) => {
			if (token.type === 'block') {
				agg[agg.length - 1].push(buildExpression(token.value));
			} else if (token.type === 'operation') {
				if (token.value === '|') {
					agg.push([]);
				} else {
					hasAnd = true;
				}
			} else {
				// exp
				agg[agg.length - 1].push(token.value);
			}

			return agg;
		},
		[[]]
	);

	let rtn = null;
	if (sets.length === 1) {
		// everything is part of one `and` statement
		rtn = new StatementExpression();
		rtn.setJoin(joiners.and);

		sets[0].forEach((exp) => {
			rtn.addExpressable(exp);
		});
	} else {
		rtn = new StatementExpression();
		rtn.setJoin(joiners.or);

		if (hasAnd) {
			sets.forEach((orSet) => {
				if (orSet.length > 1) {
					const inside = new StatementExpression();
					inside.setJoin(joiners.and);

					orSet.forEach((exp) => {
						inside.addExpressable(exp);
					});

					rtn.addExpressable(inside);
				} else {
					rtn.addExpressable(orSet[0]);
				}
			});
		} else {
			// everything is part of one `or` statement
			sets.flat().forEach((exp) => {
				rtn.addExpressable(exp);
			});
		}
	}

	return rtn;
}

module.exports = {
	compiler,
	buildExpression
};
