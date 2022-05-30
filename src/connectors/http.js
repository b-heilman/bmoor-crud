const {create} = require('bmoor/src/lib/error.js');

const {QueryStatement} = require('../schema/query/statement.js');
const {
	ExecutableStatement,
	methods
} = require('../schema/executable/statement.js');

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
			if (!ctx.canFetch()) {
				throw create('context has no defined fetch', {
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
			} else if (stmt instanceof ExecutableStatement) {
				if (stmt.method === methods.create) {
					method = 'post';
				} else if (stmt.method === methods.update) {
					method = 'patch';
				} else {
					method = 'delete';
				}

				({query, ...request} = stmt.toRequest());

				url = new URL(connectorSettings.crudBase + '/' + request.base);
			} else {
				throw create('unknown statement type', {
					code: 'BMOOR_CRUD_CONNECTOR_HTTP_UNKNOWN'
				});
			}

			if (query) {
				url.searchParams.append('query', query);
			}

			// queryBase vs crudBase
			const body = JSON.stringify(request, null, 2);
			const res = await ctx.fetch(url, {
				method,
				body,
				headers: {'Content-Type': 'application/json'} // ctx.fetch should be able to wrap security headers
			});

			// validate the status response
			if (res.ok){
				return res.json();
			} else {
				let response = {};

				try {
					response = await res.json();
				} catch(ex){
					// TODO: if it's not JSON, what do I want to do?
				}

				// TODO: handle 300s
				throw create(
					response.message||'downstream server failed', 
					Object.assign(response, {
						code: 'BMOOR_CRUD_CONNECTOR_HTTP_STATUS',
						status: response.status
					})
				);
			}
		}
	};
}

module.exports = {
	factory(settings /*nexus*/) {
		return buildConnector(settings);
	}
};
