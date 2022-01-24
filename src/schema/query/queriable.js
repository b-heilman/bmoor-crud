const {QueryStatement} = require('./statement.js');
const {StatementField} = require('../statement/field.js');

// rename this to shard
class Queriable extends QueryStatement {
	constructor(name, baseSeries) {
		super(baseSeries);

		this.name = name;
		this.sourceName = null;
		this.fieldIndex = {};
	}

	clone() {
		const exe = new Queriable(this.name, this.base);

		exe.import(this);

		exe.source = this.source;

		return exe;
	}

	getInOrder() {
		// we assume the models are already in order
		return Object.values(this.models);
	}

	setModel(series, model) {
		if (this.sourceName) {
			if (this.sourceName !== model.incomingSettings.source) {
				throw new Error('not able to mix sources in an executable');
			}
		} else {
			this.sourceName = model.incomingSettings.source;
		}

		return super.setModel(series, model);
	}

	addFields(series, fields) {
		fields.forEach((field) => {
			this.fieldIndex[series + ':' + field.path] = field.as;
		});

		return super.addFields(series, fields);
	}

	// takes an iternal field, and if found, returns external
	getField(series, internal) {
		return this.fieldIndex[series + ':' + internal] || null;
	}

	addTempField(series, name, internal) {
		this.addFields(series, [new StatementField(internal, name)]);

		return name;
	}

	getIdentifier() {
		// the name should be set by the querier, so this should be unique to it...
		return (
			this.name +
			'>' +
			this.params.expressables.map((param) => {
				return (
					param.series +
					':' +
					param.path +
					':' +
					param.operation +
					':' +
					param.value
				);
			}).flat().join()
		);
	}

	toJSON() {
		const rtn = super.toJSON();

		rtn.sourceName = this.sourceName;

		return rtn;
	}
}

module.exports = {
	Queriable
};
