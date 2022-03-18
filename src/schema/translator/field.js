const {create} = require('bmoor/src/lib/error.js');

const {pathToAccessors} = require('../../graph/path.js');

module.exports = {
	translateField: function (toStatement, fromStatement) {
		// if it's an = fromStatement, the properties can't be short hand
		const action = pathToAccessors(fromStatement)[0]; // this is an array of action tokens
		if (!action) {
			throw create(`unable to parse ${fromStatement}`, {
				code: 'BMOOR_CRUD_COMPOSITE_PARSE_STATEMENT',
				context: {
					fromStatement
				}
			});
		}

		const isArray = toStatement.indexOf('[0]') !== -1;

		const path = toStatement.substring(
			0,
			isArray ? toStatement.length - 3 : toStatement.length
		);

		return {
			type: action.loader,
			action,
			statement: fromStatement,
			path,
			isArray
		};
	}
};
