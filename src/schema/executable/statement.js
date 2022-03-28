const {set} = require('bmoor/src/core.js');

const {Statement, methods} = require('../statement.js');

class ExecutableStatement extends Statement {
	getSeries(series) {
		const rtn = super.getSeries(series);

		if (!rtn.payload) {
			rtn.payload = null;
		}

		return rtn;
	}

	setPayload(series, payload) {
		if (this.baseSeries.series !== series) {
			throw new Error('Must be primary series for payload');
		}

		this.baseSeries.payload = payload;

		return this;
	}

	importSeries(series, statement) {
		const incoming = super.importSeries(series, statement);

		this.payload = incoming.payload;

		return incoming;
	}

	// TODO: really need a way to validate everything in one place
	toRequest() {
		const base = this.baseSeries;

		return {
			base: base.schema,
			alias: base.series,
			// note the absence of joins here
			payload: base.payload,
			...super.toRequest(),
			remap: Object.values(this.models).reduce((agg, model) => {
				model.fields.forEach((field) => {
					set(agg, field.as || field.path, field.path);
				});

				return agg;
			}, {})
		};
	}

	toJSON() {
		const json = super.toJSON();

		if (json.models.length > 1) {
			throw new Error('multiple models not supported');
		}

		let method = '';
		// sanity check based on method
		if (this.method === methods.create) {
			method = 'create';
			// params aren't allowed here
			if (json.params.length) {
				throw new Error('creating with params');
			}

			json.models[0].payload = this.baseSeries.payload;
		} else if (this.method === methods.update) {
			method = 'update';

			if (!json.params.expressables.length) {
				throw new Error('update without a target');
			}

			json.models[0].payload = this.baseSeries.payload;
		} else if (this.method === methods.delete) {
			method = 'delete';
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
