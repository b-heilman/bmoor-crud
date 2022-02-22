const {create} = require('bmoor/src/lib/error.js');
const {implode} = require('bmoor/src/object.js');

const {pathToAccessors} = require('../../graph/path.js');

function instructionIndexMerge(target, source) {
	Object.keys(source).forEach((key) => {
		const existing = target[key];
		const additional = source[key];

		if (existing) {
			Object.assign(existing.join, additional.join);

			if (additional.incoming) {
				existing.incoming = existing.incoming.concat(additional.incoming);
			}
		} else if (additional.composite) {
			target[key] = {
				series: additional.series,
				composite: additional.composite,
				isNeeded: additional.isNeeded,
				optional: additional.optional,
				incoming: additional.incoming.slice(0)
			};
		} else {
			target[key] = {
				model: additional.model,
				series: additional.series,
				isNeeded: additional.isNeeded,
				optional: additional.optional,
				incoming: additional.incoming.slice(0),
				join: Object.assign({}, additional.join)
			};
		}
	});

	return target;
}

function absorbIndexMerge(target, source, namespace = '') {
	Object.keys(source).forEach((series) => {
		const namespacedSeries = namespace + series;
		const existing = target[namespacedSeries];
		const additional = source[series];
		const incoming = additional.incoming.map(
			(inSeries) => namespace + inSeries
		);

		if (additional.composite) {
			target[namespacedSeries] = {
				series: namespace + additional.series,
				composite: additional.composite,
				isNeeded: additional.isNeeded,
				optional: additional.optional,
				incoming
			};
		} else {
			const namespacedJoin = Object.keys(additional.join).reduce(
				(agg, joinedSeries) => {
					agg[namespace + joinedSeries] = additional.join[joinedSeries];

					return agg;
				},
				{}
			);

			// only time existing will be a hit is with the sub => new series
			if (existing) {
				Object.assign(existing.join, namespacedJoin);

				if (additional.incoming) {
					existing.incoming = existing.incoming.concat(
						additional.incoming.map((inSeries) => namespace + inSeries)
					);
				}
			} else {
				target[namespacedSeries] = {
					series: namespace + additional.series,
					model: additional.model,
					isNeeded: additional.isNeeded,
					optional: additional.optional,
					incoming,
					join: namespacedJoin
				};
			}
		}
	});

	return target;
}

// used to parse appart the paths that can be fed into a composite schema
class Instructions {
	constructor(baseModel, alias, joinSchema, fieldSchema, params = {}) {
		this.model = baseModel;

		if (!alias){
			alias = baseModel;
		}

		this.alias = alias;
		this.index = joinSchema.reduce(
			(agg, path) => {
				path = path.replace(/\s/g, '');

				if (path[0] !== '$') {
					path = '$' + baseModel + path;
				}

				const accessors = pathToAccessors(path);
				let last = accessors.shift();

				while (accessors.length) {
					let cur = accessors.shift();

					const {series, field} = last;

					const base = agg[series];
					if (!base) {
						throw create(`can not connect to ${series}`, {
							code: 'BMOOR_CRUD_COMPOSITE_MISSING_SERIES',
							context: {
								path
							}
						});
					}

					// this is a two way linked list, this if forward
					base.join[cur.series] = {
						from: field,
						to: cur.target
					};

					if (agg[cur.series]) {
						agg[cur.series].incoming.push(series);
					} else {
						if (cur.loader === 'include') {
							agg[cur.series] = {
								series: cur.series,
								composite: cur.model,
								isNeeded: false,
								optional: cur.optional,
								incoming: [series]
							};
						} else {
							agg[cur.series] = {
								series: cur.series,
								model: cur.model,
								isNeeded: false,
								optional: cur.optional,
								incoming: [series], // this is backwards
								join: {}
							};
						}
					}

					last = cur;
				}

				return agg;
			},
			{
				[alias]: {
					series: alias,
					model: baseModel,
					isNeeded: true,
					optional: false,
					incoming: [],
					join: {}
				}
			}
		);

		this.subs = [];
		this.fields = [];
		this.params = params;
		this.variables = {};

		// break this into
		// [path]: [accessor]
		const imploded = implode(fieldSchema);
		Object.keys(imploded).map((mount) =>
			this.addStatement(mount, imploded[mount])
		);

		Object.keys(params).map((key) => {
			if (key[0] === '$') {
				const pos = key.indexOf('.');
				const series = key.substr(1, pos - 1);

				this.getSeries(series).isNeeded = true;
			}
		});
	}

	addStatement(mount, statement, namespace = '') {
		statement = statement.replace(/\s/g, '');

		if (statement[0] === '.') {
			statement = '$' + this.alias + statement;
		}

		// if it's an = statement, the properties can't be short hand
		const action = pathToAccessors(statement)[0]; // this is an array of action tokens
		if (!action) {
			throw create(`unable to parse ${statement}`, {
				code: 'BMOOR_CRUD_COMPOSITE_PARSE_STATEMENT',
				context: {
					statement
				}
			});
		}

		const isArray = mount.indexOf('[0]') !== -1;

		const path = mount.substring(0, isArray ? mount.length - 3 : mount.length);

		const join = this.index[namespace + action.series];
		if (!join) {
			throw create(
				`requesting field not joined ${namespace ? namespace + ':' : ''}${
					action.series
				}`,
				{
					code: 'BMOOR_CRUD_COMPOSITE_MISSING_JOIN',
					context: {
						statement
					}
				}
			);
		}

		action.model = join.model;

		const info = {
			type: action.loader,
			action,
			statement,
			path,
			isArray
		};

		if (info.type === 'access') {
			let toProcess = [namespace + info.action.series];

			while (toProcess.length) {
				const curSeries = toProcess.shift();
				const cur = this.getSeries(curSeries);

				// I only need to go up the chain until I find
				// another isNeeded
				if (!cur.isNeeded) {
					cur.isNeeded = true;

					if (cur.incoming) {
						toProcess = toProcess.concat(cur.incoming);
					}
				}
			}

			this.fields.push(info);
		} else if (info.type === 'include') {
			this.subs.push(info);
		} else {
			throw create(`unknown type ${info.type}`, {
				code: 'BMOOR_CRUD_COMPOSITE_UNKNOWN',
				context: {
					info
				}
			});
		}
	}

	// this will map another set of instructions directly onto the model
	extend(parent) {
		if (this.model !== parent.model) {
			if (!this.index[parent.model]) {
				this.index[parent.model] = {
					model: parent.model,
					series: parent.model,
					isNeeded: true,
					optional: false,
					incoming: [this.model],
					join: {}
				};

				this.index[this.alias].join[parent.model] = {
					from: null,
					to: null
				};
			}
		}

		this.index = instructionIndexMerge(this.index, parent.index);

		this.subs = this.subs.concat(parent.subs);
		this.fields = this.fields.concat(parent.fields);

		return !!parent.subs.length;
	}

	// will map another set of instructions into a specific property
	inline(series, instructions) {
		// I need to convert the sub into a position on the index.
		const sub = this.subs.filter((info) => info.action.series === series)[0];
		const path = sub.path;
		const namespace = sub.action.series;

		const dex = this.index[namespace];

		if (dex) {
			delete this.index[namespace];

			const namespacedTarget = namespace + instructions.model;

			// this needs to convert from sub to model shape
			this.index[namespacedTarget] = {
				model: instructions.model,
				series: namespacedTarget,
				isNeeded: true,
				optional: false,
				incoming: dex.incoming,
				join: {}
			};

			dex.incoming.forEach((incoming) => {
				const incomingDex = this.index[incoming];

				const join = incomingDex.join[namespace];

				delete incomingDex.join[namespace];

				incomingDex.join[namespacedTarget] = join;
			});
		} else {
			throw new Error('how did we get here?');
		}

		this.index = absorbIndexMerge(this.index, instructions.index, namespace);

		// first we remove the sub that is at the root position, then we
		// add any additional subs
		this.subs = this.subs
			.filter((info) => info.path !== path)
			.concat(
				instructions.subs.map((info) => {
					const rtn = Object.assign({}, info);

					rtn.path = path + '.' + info.path;

					rtn.action = Object.assign({}, rtn.action);

					rtn.action.series = namespace + rtn.action.series;

					return rtn;
				})
			);

		this.fields = this.fields.concat(
			instructions.fields.map((info) => {
				const rtn = Object.assign({}, info);

				rtn.path = path + '.' + info.path;

				rtn.action = Object.assign({}, rtn.action);

				rtn.action.series = namespace + rtn.action.series;

				return rtn;
			})
		);

		return !!instructions.subs.length;
	}

	// this method will take an array of series which are the leafs
	// and it figures out all series needed
	getNeeded(seriesArr) {
		const rtn = new Set();

		const addSeries = (series) => {
			if (!rtn.has(series)) {
				rtn.add(series);

				this.getSeries(series).incoming.map(addSeries);
			}
		};

		seriesArr.map(addSeries);

		return rtn;
	}

	getAllSeries() {
		return Object.keys(this.index);
	}

	getSeries(series) {
		return this.index[series];
	}

	getJoin(from, to) {
		return this.index[from].join[to];
	}

	getIncoming(to) {
		return this.getSeries(to).incoming;
	}

	forEach(fn) {
		const processed = {};

		let toProcess = [this.alias];
		while (toProcess.length) {
			const seriesName = toProcess.shift();

			if (processed[seriesName]) {
				return;
			} else {
				processed[seriesName] = true;
			}

			const seriesInfo = this.getSeries(seriesName);

			fn(seriesName, seriesInfo);

			if (seriesInfo.join) {
				toProcess = toProcess.concat(Object.keys(seriesInfo.join));
			}
		}
	}

	getSeriesByModel(model) {
		return Object.keys(this.index).filter(
			(series) => this.index[series].model === model
		);
	}

	// returns back all the models going back to the root
	getTrace(...to) {
		const trace = [];
		let toProcess = to;

		while (toProcess.length) {
			const curSeries = toProcess.shift();
			const cur = this.getSeries(curSeries);

			trace.push(cur);

			if (cur.incoming) {
				toProcess = toProcess.concat(cur.incoming);
			}
		}

		const found = {};
		return trace.reverse().filter((cur) => {
			if (found[cur.series]) {
				return false;
			} else {
				found[cur.series] = true;
				return true;
			}
		});
	}

	getMount(doc) {
		const trace = [];
		let toProcess = [doc];

		while (toProcess.length) {
			const curSeries = toProcess.shift();
			const cur = this.getSeries(curSeries);

			trace.push(cur);

			if (cur.incoming && !cur.isNeeded) {
				toProcess = toProcess.concat(cur.incoming);
			}
		}

		const found = {};
		return trace.reverse().filter((cur) => {
			if (found[cur.series]) {
				return false;
			} else {
				found[cur.series] = true;
				return true;
			}
		});
	}

	// TODO: I should do something that calculates the relationships for join
	getOutgoingLinks(series) {
		const rtn = [];
		const seriesInfo = this.getSeries(series);

		if (seriesInfo.incoming) {
			seriesInfo.incoming.forEach((incomingSeries) => {
				const join = this.getJoin(incomingSeries, series);

				const direction = join.relationship.metadata.direction;
				const vector = join.relationship.name;
				if (
					(vector === series && direction === 'incoming') ||
					(vector !== series && direction === 'outgoing')
				) {
					rtn.push({
						local: join.to,
						remote: join.from,
						series: incomingSeries
					});
				}
			});
		}

		Object.keys(seriesInfo.join).forEach((outgoingSeries) => {
			const join = seriesInfo.join[outgoingSeries];

			const direction = join.relationship.metadata.direction;
			const vector = join.relationship.name;
			if (
				(vector === series && direction === 'incoming') ||
				(vector !== series && direction === 'outgoing')
			) {
				rtn.push({
					local: join.from,
					remote: join.to,
					series: outgoingSeries
				});
			}
		});

		return rtn;
	}
}

module.exports = {
	Instructions
};
