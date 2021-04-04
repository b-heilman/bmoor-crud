
class Router {
	constructor(path){
		this.path = path;

		this.subs = [];
		this.routes = [];
	}

	addRoutes(routes){
		this.routes = this.routes.concat(routes);
	}

	addRouters(routers){
		this.subs = this.subs.concat(routers);
	}

	toJSON(){
		return {
			$schema: 'bmoor-crud:router',
			path: this.path,
			routes: this.routes.concat(this.subs).sort(
				(a,b) => {
					if (a.path === b.path){
						return a.method.localeCompare(b.method);
					} else {
						return a.path.localeCompare(b.path);
					}
				}
			)
		};
	}
}

module.exports = {
	Router
};
