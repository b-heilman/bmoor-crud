//---------Tokenizer--------
const {Config} = require('bmoor/src/lib/config.js');

const {Token} = require('bmoor-data/src/expression/Token.js');
const {Compound} = require('bmoor-data/src/expression/Compound.js');
const {Compiler} = require('bmoor-data/src/expression/Compiler.js');

const isCharacter = /[A-Za-z_0-9]/;
const isSpace = /[\W]/;

const parsings = new Config({
	// $foo, $bar,
	reference: {
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

			if (isCharacter.test(ch) || ch === '-') {
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
	},

	// .path
	accessor: {
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

			if (isCharacter.test(ch) || ch === '-' || ch === '.') {
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
	},

	// #dupe
	child: {
		open: function (master, pos) {
			if (master[pos] === '#') {
				return {
					pos: pos + 1,
					begin: pos + 1
				};
			}
		},
		close: function (master, pos, state) {
			const ch = master[pos];

			if (isCharacter.test(ch) || ch === '-') {
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

			return new Token('child', model, {series});
		}
	},

	// @variable
	variable: {
		open: function (master, pos) {
			if (master[pos] === '@') {
				return {
					pos: pos + 1,
					begin: pos + 1
				};
			}
		},
		close: function (master, pos) {
			const ch = master[pos];

			if (isCharacter.test(ch) || ch === '-') {
				return false;
			}

			return {
				pos,
				end: pos - 1
			};
		},
		toToken: function (content) {
			return new Token('variable', content);
		}
	},

	join: {
		open: function (master, pos) {
			if (master[pos] === '>') {
				return {
					pos: pos + 1,
					begin: pos + 1
				};
			}
		},
		close: function (master, pos, state) {
			const ch = master[pos];

			if (!isSpace.test(ch)) {
				return false;
			} else if (ch === '?') {
				state.optional = true;

				return false;
			}

			return {
				pos,
				end: pos - 1
			};
		},
		toToken: function (content, metadata) {
			return new Token('join', content, metadata);
		}
	}
});

const composites = new Config({
	// $foo.bar
	path: {
		tokens: ['reference', 'accessor'],
		factory: function (tokens) {
			return new Compound('path', tokens, {series: tokens[0].metadata.series});
		}
	},

	incomingPath: {
		tokens: ['accessor', 'reference', 'accessor'],
		factory: function (tokens) {
			return new Compound('incoming-path', tokens, {
				series: tokens[1].metadata.series
			});
		}
	},

	incomingReference: {
		tokens: ['accessor', 'reference'],
		factory: function (tokens) {
			return new Compound('incoming-reference', tokens, {
				series: tokens[1].metadata.series
			});
		}
	},

	incomingChild: {
		tokens: ['accessor', 'child'],
		factory: function (tokens) {
			return new Compound('incoming-child', tokens, {
				series: tokens[1].metadata.series
			});
		}
	}
});

const expressions = null;

const compiler = new Compiler(parsings, expressions, composites);

//--------------------------
function pathToAccessors(field) {
	field = field.replace(/[\s]/g, ''); // remove all white space

	const tokens = compiler.tokenize(field)[0].tokens;
	const accessors = [];

	let optional = false;

	for (const token of tokens) {
		let parsed = null;

		if (token.type === 'path') {
			parsed = {
				loader: 'access',
				model: token.value[0].value,
				field: token.value[1].value,
				target: null,
				optional
			};
		} else if (token.type === 'reference') {
			parsed = {
				loader: 'access',
				model: token.value,
				field: null,
				target: null,
				optional
			};
		} else if (token.type === 'incoming-path') {
			parsed = {
				loader: 'access',
				model: token.value[1].value,
				field: token.value[2].value,
				target: token.value[0].value,
				optional
			};
		} else if (token.type === 'incoming-reference') {
			parsed = {
				loader: 'access',
				model: token.value[1].value,
				field: null,
				target: token.value[0].value,
				optional
			};
		} else if (token.type === 'child') {
			parsed = {
				loader: 'include',
				model: token.value,
				field: null,
				target: null,
				optional
			};
		} else if (token.type === 'incoming-child') {
			parsed = {
				loader: 'include',
				model: token.value[1].value,
				field: null,
				target: token.value[0].value,
				optional
			};
		} else if (token.type === 'join') {
			if (token.metadata.optional) {
				optional = true;
			}
		} else if (token.type === 'method') {
			accessors.push({
				loader: 'method',
				arguments: token.value
			});
		} else {
			throw new Error(
				`unknown token type: ${token.type}(${token.value}) of ${field}`
			);
		}

		if (parsed) {
			if (token.metadata && token.metadata.series) {
				parsed.series = token.metadata.series;
			} else {
				parsed.series = parsed.model;
			}

			accessors.push(parsed);
		}
	}

	return accessors;
}

parsings.set('method', {
	open: function (master, pos, state) {
		if (master[pos] === '=') {
			const next = master.indexOf('(', pos + 2); // it's at least gotta be =a()

			state.method = master.substring(pos + 1, next).trim();

			return {
				pos: next + 1,
				begin: next + 1
			};
		}
	},
	// I'm not allowing sub methods, and I don't have anything else that used (), so
	// I can simplify this logid
	close: function (master, pos) {
		const ch = master[pos];

		if (ch !== ')') {
			return false;
		}

		return {
			pos: pos + 1,
			end: pos - 1
		};
	},
	toToken: function (content, metadata) {
		return new Token(
			'method',
			content.split(',').map(pathToAccessors),
			metadata
		);
	}
});

function accessorsToPath(accessors) {
	return accessors
		.map(function (field) {
			const rtn = [];

			if (field.optional) {
				rtn.push('?');
			}

			if (field.target) {
				rtn.push('.' + field.target);
			}

			if (field.loader) {
				if (field.loader === 'access') {
					rtn.push('$');
				} else if (field.loader === 'include') {
					rtn.push('#');
				} else {
					throw new Error('unknown loader');
				}
			} else {
				throw new Error('no loader defined');
			}

			if (field.model) {
				rtn.push(field.model);
			} else {
				throw new Error('no model defined');
			}

			if (field.field) {
				rtn.push('.' + field.field);
			}

			return rtn.join('');
		})
		.join('>');
}

class Path {
	constructor(path) {
		if (Array.isArray(path)) {
			// path is an array of accessors and needs to built
			this.path = accessorsToPath(path);
			this.access = path;
		} else {
			// path is a string and needs to be parsed
			this.path = path;
			this.access = pathToAccessors(path);
		}
	}
}

module.exports = {
	compiler,
	pathToAccessors,
	accessorsToPath,
	Path
};
