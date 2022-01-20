class StatementParam {
	/***
	 * values
	 * op
	 * ----
	 * value
	 * op
	 ***/
	constructor(path, value, operation = '=', settings = {}) {
		this.path = path;
		this.operation = operation;
		this.value = value;
		this.settings = settings;
	}
}

module.exports = {
	StatementParam
};
