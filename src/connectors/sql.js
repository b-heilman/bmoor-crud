const error = require('bmoor/src/lib/error.js');

const {
	StatementExpression,
	joiners
} = require('../schema/statement/expression.js');
const {QueryStatement} = require('../schema/query/statement.js');
const {
	ExecutableStatement,
	methods
} = require('../schema/executable/statement.js');

const arrayMethods = {
	'=': 'IN'
};

const scalarMethods = {
	'=': '=',
	eq: '=',
	lt: '<',
	lte: '<=',
	gt: '>',
	gte: '>='
};

function translateExpressable(expression) {
	const where = [];
	const params = [];

	expression.expressables.forEach((exp) => {
		if (exp instanceof StatementExpression) {
			const res = translateWhere(exp);

			where.push('(' + res.stmt + ')');
			params.push(...res.params);
		} else {
			const path = exp.path;
			const op = exp.operation;

			// has to be a param
			if (Array.isArray(exp.value)) {
				const comp = arrayMethods[op];

				where.push(`\`${exp.series}\`.\`${path}\`${comp}(?)`);
				params.push(exp.value);
			} else {
				const comp = scalarMethods[op];

				where.push(`\`${exp.series}\`.\`${path}\`${comp}?`);
				params.push(exp.value);
			}
		}
	});

	return {
		stmt: where.join(expression.joiner === joiners.and ? ' AND ' : ' OR '),
		params
	};
}

function translateSelect(query) {
	const settings = query.getInOrder().reduce(
		(agg, model) => {
			const modelName = model.schema;
			const modelRef = model.series;

			model.fields.forEach((field) => {
				// as => alias
				if (field.as) {
					agg.select.push(
						`\`${modelRef}\`.\`${field.path}\` AS \`${field.as}\``
					);
				} else {
					agg.select.push(`\`${modelRef}\`.\`${field.path}\``);
				}
			});

			if (model.joins) {
				const joins = Object.values(model.joins);
				if (joins.length) {
					joins.forEach((join) => {
						const type = join.optional ? 'LEFT JOIN' : 'INNER JOIN';
						const joinPoint = `${type} \`${modelName}\` AS \`${modelRef}\``;

						// I support this, but it never happens in the framework
						const on = join.mappings.map((on) => {
							const dis = `\`${modelRef}\`.\`${on.from}\``;
							const dat = `\`${join.name}\`.\`${on.to}\``;

							return `${dis} = ${dat}`;
						});

						agg.from.push(`${joinPoint} ON ${on.join(' AND ')}`);
					});
				} else {
					agg.from.push(`\`${modelName}\` AS \`${modelRef}\``);
				}
			} else {
				// I hate duplicating lines, but I'm tired
				agg.from.push(`\`${modelName}\` AS \`${modelRef}\``);
			}

			return agg;
		},
		{
			select: [],
			from: []
		}
	);

	const sorts = query.sorts;

	const position = query.position;

	return {
		select: `${settings.select.join(',\n\t')}`,
		from: `${settings.from.join('\n\t')}`,
		orderBy:
			sorts && sorts.length
				? sorts
						.sort((a, b) => a.pos - b.pos)
						.map(
							(order) =>
								`\`${order.series}\`.\`${order.path}\` ` +
								(order.ascending ? 'ASC' : 'DESC')
						)
						.join(',')
				: null,
		limit: position
			? position.start
				? position.start + ',' + position.limit
				: position.limit
			: null
	};
}

function translateWhere(stmt) {
	const where = translateExpressable(stmt.params);

	if (stmt.filters.isExpressable()) {
		const t = translateExpressable(stmt.filters);

		if (where.stmt) {
			where.stmt += ' AND ' + t.stmt;
		} else {
			where.stmt = t.stmt;
		}

		where.params.push(...t.params);
	}

	return {
		where: where.stmt.length ? where.stmt : null,
		params: where.params
	};
}

function buildConnector(settings) {
	return {
		prepare: async function (stmt) {
			if (stmt instanceof QueryStatement) {
				const select = translateSelect(stmt);
				const where = translateWhere(stmt);

				let sql = `SELECT ${select.select} \nFROM ${select.from}`;

				if (where.where) {
					sql += `\nWHERE ${where.where}`;
				}

				if (select.orderBy) {
					sql += `\nORDER BY ${select.orderBy}`;
				}

				if (select.limit) {
					sql += `\nLIMIT ${select.limit}`;
				}

				return {
					params: where.params,
					sql,
					resultIndex: 0
				};
			} else if (stmt instanceof ExecutableStatement) {
				const params = [];

				let sql = '';
				let resultIndex = null;

				if (stmt.method === methods.create) {
					const select = translateSelect(stmt);

					// ` ON DUPLICATE KEY UPDATE ?`;
					/*stmt.getInOrder().forEach((model) => {
						const keyField = model.model.getKeyField();
						
						if (model.payload){
							sql += `
							INSERT INTO ${model.schema} SET ?;
							
							SELECT ${select.select}
							FROM ${model.schema}
							WHERE ${keyField} = last_insert_id();
							`;

							params.push(model.payload);
						}
					});*/
					const keyField = stmt.baseSeries.model.getKeyField();

					sql += `
					INSERT INTO ${stmt.baseSeries.schema} SET ?;
					
					SELECT ${select.select}
					FROM ${select.from}
					WHERE ${keyField} = last_insert_id();
					`;

					params.push(stmt.baseSeries.payload);
					resultIndex = 1;
				} else if (stmt.method === methods.update) {
					const select = translateSelect(stmt);
					const where = translateWhere(stmt);

					// I can't figure out how to unwind this from the
					// models, so only the primary can be updated
					sql = `
					UPDATE ${stmt.baseSeries.schema} SET ?
					WHERE ${where.where};
					
					SELECT ${select.select}
					FROM ${select.from}
					WHERE ${where.where};
					`;

					params.push(stmt.baseSeries.payload);
					params.push(...where.params);
					params.push(...where.params);
					resultIndex = 1;
				} else {
					const select = translateSelect(stmt);
					const where = translateWhere(stmt);

					// I can't figure out how to unwind this from the
					// models, so only the primary can be deleted
					sql = `
					DELETE ${stmt.baseSeries.schema} 
					FROM ${select.from}
					WHERE ${where.where};
					`;

					params.push(...where.params);
				}

				return {
					params,
					sql,
					resultIndex
				};
			} else {
				throw error('unknown statement type', {
					code: 'BMOOR_CRUD_CONNECTOR_SQL_UNKNOWN'
				});
			}
		},

		run: async function (sql, params) {
			return settings.run(sql, params);
		},

		execute: async function (stmt) {
			const {sql, params, resultIndex} = await this.prepare(stmt);

			const res = await this.run(sql, params);

			if (resultIndex === null) {
				return res;
			} else {
				return res[resultIndex];
			}
		}
	};
}

module.exports = {
	factory(settings) {
		return buildConnector(settings);
	}
};
