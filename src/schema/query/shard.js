const {QueryStatement} = require('./statement.js');
const {StatementField} = require('../statement/field.js');

// TODO: rename this to QueryShard
class QueryShard extends QueryStatement {
	// TODO: I don't like that I did this, it should keep the parent
	//   constructor pattern
	constructor(baseSeries, baseModel, name) {
		super(baseSeries, baseModel);

		this.name = name;
		this.fieldIndex = {};
		this.temps = [];
	}

	clone() {
		const exe = new QueryShard(
			this.baseSeries.series,
			this.baseSeries.model,
			this.name
		);

		exe.import(this);

		exe.source = this.source;

		return exe;
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
		this.temps.push(name);
		
		this.addFields(series, [new StatementField(internal, name)]);

		return name;
	}

	getIdentifier() {
		// the name should be set by the querier, so this should be unique to it...
		return (
			this.name +
			'>' +
			this.params.expressables
				.map((param) => {
					return (
						param.series +
						':' +
						param.path +
						':' +
						param.operation +
						':' +
						param.value
					);
				})
				.flat()
				.join()
		);
	}

	toJSON() {
		const rtn = super.toJSON();

		rtn.sourceName = this.sourceName;

		return rtn;
	}
}

module.exports = {
	QueryShard
};
