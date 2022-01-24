class StatementFilter {
	/***
	 * values
	 * op
	 * ----
	 * value
	 * op
	 ***/
	constructor(series, path, value, operation = '=', settings = {}) {
		this.series = series;
		this.path = path;
		this.operation = operation;
		this.value = value;
		this.settings = settings;
	}

	toJSON() {
		return {
			series: this.series,
			path: this.path,
			operation: this.operation,
			value: this.value,
			settings: this.settings
		};
	}
}

module.exports = {
	StatementFilter
};
