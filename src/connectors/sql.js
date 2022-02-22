const {
	StatementExpression,
	joiners
} = require('../schema/statement/expression.js');

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

function translateWhere(expression) {
	const where = [];
	const params = [];

	expression.expressables.forEach((exp) => {
		if (exp instanceof StatementExpression) {
			const res = translateWhere(exp);

			where.push('('+res.stmt+')');
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
		stmt: where.join(expression.joiner === joiners.and ? ' AND ' : ' OR ')
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

			return agg;
		},
		{
			select: [],
			from: [],
			where: [],
			params: []
		}
	);

	const where = translateWhere(query.params);

	if (query.filters.isExpressable()){
		const t = translateWhere(query.filters);

		if (where.stmt){
			where.stmt += ' AND '+t.stmt;
		} else {
			where.stmt = t.stmt;
		}

		where.params.push(...t.params);
	}

	const sorts = query.sorts;

	const position = query.position;
	return {
		select: `${settings.select.join(',\n\t')}`,
		from: `${settings.from.join('\n\t')}`,
		where: where.stmt.length ? settings.stmt : null,
		params: where.params,
		orderBy: sorts.length
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

const connector = {
	prepare: async function (stmt) {
		const query = translateSelect(stmt);

		let sql = `SELECT ${query.select} \nFROM ${query.from}`;

		if (query.where) {
			sql += `\nWHERE ${query.where}`;
		}

		if (query.orderBy) {
			sql += `\nORDER BY ${query.orderBy}`;
		}

		if (query.limit) {
			sql += `\nLIMIT ${query.limit}`;
		}

		return {
			query,
			sql
		};
	},

	run: async function (sql, params) {
		console.log('------\n', sql, '\n===', params, '\n------');
	},

	execute: async function (stmt) {
		const prepared = await this.prepare(stmt);

		return this.run(prepared.sql, prepared.query.params, stmt);
	}
};

module.exports = {
	translateSelect,

	connector,

	factory() {
		return connector;
	}
};
