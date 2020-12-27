
class Route {
	constructor(path, method, action, settings = {}){
		this.method = method;
		this.path = path;
		this.action = action;
		this.settings = settings;
	}
}

module.exports = {
	Route
};
