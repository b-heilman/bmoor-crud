
const error = require('bmoor/src/lib/error.js');
const {Config} = require('bmoor/src/lib/config.js');

const config = new Config({
	fetch: null
});

const connector = {
	execute: function(stmt){
		const fetch = config.get('fetch');

		if (!fetch){
			throw error('no knex connector configured', {
				code: 'BMOOR_CRUD_CONNECTOR_KNEX'
			});
		}

		console.log(stmt);
	}
};

module.exports = {
	config,

	connector,

	factory(){
		return connector;
	}
};
