const error = require('bmoor/src/lib/error.js');

// this converts a request into one another bmoor-crud instance can decode
//-----------
// sources allow us to solve the multiple upstream problem, so each source instance will reference
// create a connector with different connectorSettings

/**
 * connectorSettings {
 *   base // path to the remove server's querier 
 * }
 **/
function buildConnector(connectorSettings){
	return {
		execute: async function (stmt, ctx) {
			if (!ctx.fetch) {
				throw error('context has no defined fetch', {
					code: 'BMOOR_CRUD_CONNECTOR_HTTP'
				});
			}

			//We need to build the content as a post
			const {query, ...request} = stmt.toRequest();

			var url = new URL(connectorSettings.base);
			url.searchParams.append('query', query);

			// queryBase vs crudBase
			const res = await ctx.fetch(url, {
				method: 'post',
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
