class Route {
	constructor(path, method, action, settings = {}) {
		this.method = method;
		this.path = path;
		this.action = action;
		this.settings = settings;
	}

	toJSON() {
		return {
			$schema: 'bmoor-crud:route',
			method: this.method,
			path: this.path
		};
	}
}

module.exports = {
	Route
};
