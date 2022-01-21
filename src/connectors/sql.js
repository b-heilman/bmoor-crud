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

function translateSelect(query) {
	const sorts = [];

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

			model.params.forEach((param) => {
				const path = param.path;
				const op = param.operation;

				if (Array.isArray(param.value)) {
					const comp = arrayMethods[op];

					agg.where.push(`\`${modelRef}\`.\`${path}\`${comp}(?)`);
					agg.params.push(param.value);
				} else {
					const comp = scalarMethods[op];

					agg.where.push(`\`${modelRef}\`.\`${path}\`${comp}?`);
					agg.params.push(param.value);
				}
			});

			sorts.push(
				...model.sorts.map((sort) => ({
					series: modelRef,
					...sort
				}))
			);

			return agg;
		},
		{
			select: [],
			from: [],
			where: [],
			params: []
		}
	);

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
