class StatementField {
	constructor(path, alias = null) {
		this.path = path;
		this.as = alias;
	}
}

module.exports = {
	StatementField
};
