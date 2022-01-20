class Router {
	constructor(path) {
		this.path = path;

		this.subs = [];
		this.routes = [];
	}

	addRoutes(routes) {
		this.routes = this.routes.concat(routes);
	}

	getRoutes() {
		return this.routes;
	}

	addRouters(routers) {
		this.subs = this.subs.concat(routers);
	}

	getRouters() {
		return this.subs;
	}

	toJSON() {
		return {
			$schema: 'bmoor-crud:router',
			path: this.path,
			routes: this.routes.concat(this.subs).sort((a, b) => {
				if (a.path === b.path) {
					return a.method.localeCompare(b.method);
				} else {
					return a.path.localeCompare(b.path);
				}
			})
		};
	}
}

module.exports = {
	Router
};
