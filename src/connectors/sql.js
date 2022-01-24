const {Expression, joiners} = require('../schema/statement/expression.js');

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

function translateWhere(expression, agg) {
	expression.expressables.forEach((exp) => {
		if (exp instanceof Expression) {
			const myCtx = {
				where: [],
				params: {
					expressables: [],
					join: 'and'
				}
			};

			translateWhere(exp, myCtx);

			const where =
				'(' +
				myCtx.where.join(exp.joiner === joiners.and ? ' AND ' : ' OR ') +
				')';

			agg.where.push(where);
			agg.params.push(...myCtx.params);
		} else {
			const path = exp.path;
			const op = exp.operation;

			// has to be a param
			if (Array.isArray(exp.value)) {
				const comp = arrayMethods[op];

				agg.where.push(`\`${exp.series}\`.\`${path}\`${comp}(?)`);
				agg.params.push(exp.value);
			} else {
				const comp = scalarMethods[op];

				agg.where.push(`\`${exp.series}\`.\`${path}\`${comp}?`);
				agg.params.push(exp.value);
			}
		}
	});
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

	const params = translateWhere(query.params, settings);

	const sorts = query.sorts;

	const position = query.position;
	return {
		select: `${settings.select.join(',\n\t')}`,
		from: `${settings.from.join('\n\t')}`,
		where: settings.where.length ? settings.where.join('\n\tAND ') : null,
		params: settings.params,
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
