
class Router {
	constructor(path, nexus, controller){
		this.path = path;
		this.nexus = nexus;
		this.controller = controller;
	}

	getRoutes(){
		return this.controller.getRoutes(this.nexus);
	}

	toJSON(){
		return {
			path: this.path,
			routes: this.controller.toJSON()
		};
	}
}

module.exports = {
	Router
};
