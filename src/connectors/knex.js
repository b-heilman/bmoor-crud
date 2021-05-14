
const error = require('bmoor/src/lib/error.js');
const {Config} = require('bmoor/src/lib/config.js');

const config = new Config({
	knex: null
});

// TODO: a lot
// add sort-by and possibly limit if doing pagination...
// filter needs to be decoded and passed down to here, join is just a 
// glorified filter
/*****
 * --- stms ----
 * models: [
    name
    schema
    series
 *  fields: [{
	  
 }]
    join: [{
	  optional
	  on: [{
	    local
	    remote
	  }]
    }]
    query: [{
	  [field] => [] || '' || 123 ||  {
	    op
	    value
	    --- cross ref
	    name
	    field
	  }
    }]
 * ]
 *****/
function translateSelect(stmt){
	const settings = stmt.query.getInOrder().reduce(
		(agg, model) => {
			const modelName = model.schema;
			const modelRef = model.series;

			model.fields.forEach(field => {
				// as => alias
				if (field.as){
					agg.select.push(`\`${modelRef}\`.\`${field.path}\` AS \`${field.as}\``);
				} else {
					agg.select.push(`\`${modelRef}\`.\`${field.path}\``);
				}
			});

			const joins = Object.values(model.joins);
			if (joins.length){
				joins.forEach(join => {
					const type = join.optional ? 'LEFT JOIN' : 'INNER JOIN';
					const joinPoint = `${type} \`${modelName}\` AS \`${modelRef}\``;

					const on = join.mappings.map(on => {
						const dis = `\`${modelRef}\`.\`${on.from}\``;
						const dat = `\`${join.name}\`.\`${on.to}\``;

						return `${dis} = ${dat}`;
					});

					agg.from.push(`${joinPoint} ON ${on.join(' AND ')}`);
				});
			} else {
				agg.from.push(`\`${modelName}\` AS \`${modelRef}\``);
			}

			model.params.forEach(param => {
				const path = param.path;
				const operation = param.operation;

				if (operation.values){
					agg.where.push(`\`${modelRef}\`.\`${path}\`IN(?)`);
					agg.params.push(operation.values);
				} else {
					const op = operation.op || '=';

					agg.where.push(`\`${modelRef}\`.\`${path}\`${op}?`);
					agg.params.push(operation.value);
				}
			});

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
