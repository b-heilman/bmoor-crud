
class Context {
	constructor(systemContext = {}){
		this.ctx = systemContext;
		this.query = systemContext.query || null;
		this.params = systemContext.params || {};
		this.method = (systemContext.method || 'none').toLowerCase();
		this.content = systemContext.content || null;
		this.permissions = systemContext.permissions || {};

		this.changes = [];
		this.trackingChanges = true;

		// controller specific properties
		this.info = {};
	}

	setInfo(info){
		this.info = Object.assign(this.info, info);
	}

	// allow to constructor to do some sort of boot script
	async isReady(){
		return true;
	}

	hasPermission(permission){
		return !!this.permissions[permission];
	}

	// method
	getMethod(){
		return this.method;
	}

	// params
	hasParam(name){
		return name in this.params;
	}

	setParam(name, value){
		this.params[name] = value;
	}

	getParam(name){
		if (this.params && name in this.params){
			return this.params[name];
		} else {
			return null;
		}
	}

	// query
	hasQuery(){
		return !!this.query;
	}

	getQuery(name){
		if (this.query && name in this.query){
			return this.query[name];
		} else if (!name){
			return this.query;
		} else {
			return null;
		}
	}

	async getContent(){
		return this.content;
	}

	async getFiles(){
		return this.ctx.files || null;
	}

	getRaw(){
		return this.ctx;
	}

	trackChanges(toggle){
		this.trackingChanges = toggle;
	}

	addChange(model, action, key, from, to = null, md={}){
		if (this.trackingChanges){
			this.changes.push({
				model,
				action,
				key,
				from,
				to,
				md
			});
		}
	}

	// server/controller is written to handle the rollback condition
	getChanges(){
		return this.changes.slice(0);
	}
}

module.exports = {
	Context
};
