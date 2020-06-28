
class Router {
	constructor(path, routes = []){
		this.path = '';
		this.routes = routes;
	}

	addRoute(route){
		this.routes.push(route);
	}

	addRouter(router){
		this.routes.push(router);
	}

	addController(controller){
		controller.getRoutes()
		.forEach(route => this.addRoute(route));
	}
}

module.exports = {
	Router
};
