const error = require('bmoor/src/lib/error.js');

const {QueryStatement} = require('../schema/query/statement.js');
const {methods} = require('../schema/executable/statement.js');

// this converts a request into one another bmoor-crud instance can decode
//-----------
// sources allow us to solve the multiple upstream problem, so each source instance will reference
// create a connector with different connectorSettings

/**
 * connectorSettings {
 *   base // path to the remove server's querier
 * }
 **/
function buildConnector(connectorSettings) {
	return {
		execute: async function (stmt, ctx) {
			if (!ctx.fetch) {
				throw error('context has no defined fetch', {
					code: 'BMOOR_CRUD_CONNECTOR_HTTP'
				});
			}

			let url = null;
			let method = null;
			let query = null;
			let request = null;

			if (stmt instanceof QueryStatement) {
				url = new URL(connectorSettings.queryBase);
				method = 'post';

				({query, ...request} = stmt.toRequest());
			} else {
				if (stmt.method === methods.create) {
					method = 'post';
				} else if (stmt.method === methods.update) {
					method = 'patch';
				} else {
					method = 'delete';
				}

				({query, ...request} = stmt.toRequest());

				url = new URL(connectorSettings.crudBase + '/' + request.base);
			}

			if (query) {
				url.searchParams.append('query', query);
			}

			// queryBase vs crudBase
			const res = await ctx.fetch(url, {
				method,
				body: JSON.stringify(request),
				headers: {'Content-Type': 'application/json'} // ctx.fetch should be able to wrap security headers
			});

			return res.json();
		}
	};
}

module.exports = {
	factory(settings) {
		return buildConnector(settings);
	}
};
