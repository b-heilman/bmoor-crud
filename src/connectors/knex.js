
const error = require('bmoor/src/lib/error.js');
const {Config} = require('bmoor/src/lib/config.js');

const {connector: sqlConnector} = require('./sql.js');

const config = new Config({
	knex: null
});

const connector = Object.create(sqlConnector);

connector.run = async function(sql, params/*, stmt*/){
	const knex = config.get('knex');

	if (!knex){
		throw error('no knex connector configured', {
			code: 'BMOOR_CRUD_CONNECTOR_KNEX'
		});
	}

	const rtn = knex.raw(sql, params)
	.then(res => res[0]);

	rtn.catch(() => {
		console.log('knex fail =>\n', sql, '\n', params);
	});

	return rtn;
};

module.exports = {
	config,

	connector,

	factory(){
		return connector;
	}
};
