
class Route {
	constructor(method, path, action, settings = {}){
		this.method = method;
		this.path = path;
		this.action = action;
		this.settings = settings;
	}
}

module.exports = {
	Route
};
