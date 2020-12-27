
const error = require('bmoor/src/lib/error.js');
const {Config} = require('bmoor/src/lib/config.js');

const config = new Config({
	knex: null
});

function translateSelect(stmt){
	const settings = stmt.models.reduce(
		(agg, model) => {
			const modelName = model.schema || model.name;
			const modelRef = model.series || model.name;

			model.fields.forEach(field => {
				if (field.as){
					agg.select.push(`\`${modelRef}\`.\`${field.path}\` AS \`${field.as}\``);
				} else {
					agg.select.push(`\`${modelRef}\`.\`${field.path}\``);
				}
			});

			if (model.join){
				const type = model.join.optional ? 'LEFT JOIN' : 'INNER JOIN';
				const join = `${type} \`${modelName}\` AS \`${modelRef}\``;

				if (model.join.on){
					const on = model.join.on.map(on => {
						const dis = `\`${modelRef}\`.\`${on.local}\``;
						const dat = `\`${on.name}\`.\`${on.remote}\``;

						return `${dis} = ${dat}`;
					});
					
					agg.from.push(`${join} ON ${on.join(' AND ')}`);
				} else {
					agg.from.push(`${join}`);
				}
			} else {
				agg.from.push(`\`${modelName}\` AS \`${modelRef}\``);
			}

			if (model.query){
				Object.keys(model.query)
				.forEach(field => {
					const match = model.query[field];

					if (Array.isArray(match)){
						agg.where.push(`\`${modelRef}\`.\`${field}\`IN(?)`);
						agg.params.push(match);
					}else if (typeof(match) !== 'object'){
						agg.where.push(`\`${modelRef}\`.\`${field}\`=?`);
						agg.params.push(match);
					}else if (match.value){
						agg.where.push(`\`${modelRef}\`.\'${field}\`${match.op}?`);
						agg.params.push(match.value);
					} else {
						agg.where.push(`\`${modelRef}\`.\`${field}\`${match.op}\`${match.name}\`.\`${match.field}\``);
					}
				});
			}

			return agg;
		}, {
			select: [],
			from: [],
			where: [],
			params: []
		}
	);

	return {
		select: `${settings.select.join(',\n\t')}`,
		from: `${settings.from.join('\n\t')}`,
		where: settings.where.length ?
			settings.where.join('\n\tAND ') : null,
		params: settings.params
	};
}

const connector = {
	execute: function(stmt){
		const knex = config.get('knex');

		if (!knex){
			throw error('no knex connector configured', {
				code: 'BMOOR_CRUD_CONNECTOR_KNEX'
			});
		}

		// console.log('=>', JSON.stringify(stmt, null, 2));
		if (stmt.method === 'read'){
			const query = translateSelect(stmt);

			let sql = `
				SELECT ${query.select}
				FROM ${query.from}
			`;

			if (query.where){
				sql += `WHERE ${query.where}`;
			}

			const rtn = knex.raw(sql, query.params)
			.then(res => res[0]);

			rtn.catch(() => {
				console.log('knex fail =>\n', sql, '\n', query.params);
			});

			return rtn;
		}
	}
};

module.exports = {
	config,

	translateSelect,

	connector,

	factory(){
		return connector;
	}
};
