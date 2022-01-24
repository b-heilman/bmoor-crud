const {Statement, methods} = require('../statement.js');

class ExecutableStatement extends Statement {
	constructor(baseSeries) {
		super(baseSeries);
	}

	getSeries(series) {
		const rtn = super.getSeries(series);

		if (!rtn.payload) {
			rtn.payload = null;
		}

		return rtn;
	}

	setPayload(series, payload) {
		this.getSeries(series).payload = payload;

		return this;
	}

	importSeries(series, statement) {
		const incoming = super.importSeries(series, statement);

		this.setPayload(series, incoming.payload);

		return incoming;
	}

	toJSON() {
		const json = super.toJSON();

		let hasPayload = false;
		json.models.map((model) => {
			const payload = this.getSeries(model.series).payload;

			if (payload) {
				hasPayload = true;

				model.payload = payload;
			}
		});

		let method = '';
		// sanity check based on method
		if (this.method === methods.create) {
			method = 'create';
			// params aren't allowed here
			if (json.params.length) {
				throw new Error('creating with params');
			}

			if (json.models.length > 1) {
				throw new Error('multiple creates not supported');
			}
		} else if (this.method === methods.update) {
			method = 'update';

			if (!json.params.expressables.length) {
				throw new Error('update without a target');
			}
		} else if (this.method === methods.delete) {
			method = 'delete';
			// no payload is allowed
			if (hasPayload) {
				throw new Error('deleting with a payload');
			}
		} else {
			throw new Error('unknown method, perhaps unndefined?');
		}

		json.method = method;

		return json;
	}
}

module.exports = {
	methods,
	ExecutableStatement
};
