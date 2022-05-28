const {create} = require('bmoor/src/lib/error.js');

const {factory: sqlFactory} = require('./sql.js');

function buildConnector(settings) {
	const connector = sqlFactory();

	connector.run = async function (sql, params) {
		const {knex} = settings;

		if (!knex) {
			throw create('no knex connector configured', {
				code: 'BMOOR_CRUD_CONNECTOR_KNEX'
			});
		}

		const rtn = knex.raw(sql, params).then((res) => res[0]);

		rtn.catch(() => {
			console.log('knex fail =>\n', sql, '\n', params);
		});

		return rtn;
	};

	return connector;
}

module.exports = {
	factory(settings) {
		return buildConnector(settings);
	}
};
