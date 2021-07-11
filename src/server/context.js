
const {get} = require('bmoor/src/core.js');
const {Waitlist} = require('./waitlist.js');

class Context {
	constructor(systemContext = {}, cfg={}, cache=null){
		cfg = Object.assign({
			query: 'query', 
			params: 'params',
			method: 'method',
			content: 'body',
			permissions: 'permissions'
		}, cfg);

		this.ctx = systemContext;
		this.query = get(systemContext, cfg.query) || null;
		this.params = get(systemContext, cfg.params) || {};
		this.method = (get(systemContext, cfg.method) || 'none').toLowerCase();
		this.content = get(systemContext, cfg.content) || null;
		this.permissions = get(systemContext, cfg.permissions) || {};

		this.changes = [];
		this.waitlist = new Waitlist();
		this.trackingChanges = true;

		// controller specific properties
		this.info = {};
		this.cache = cache;
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
		if (name){
			return name in this.params;
		} else {
			return this.params && Object.keys(this.params).length !== 0;
		}
		
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
	hasQuery(name){
		if (name){
			return name in this.query;
		} else {
			return this.query && Object.keys(this.query).length !== 0;
		}
	}

	getQuery(name){
		if (this.query && name in this.query){
			return this.query[name];
		} else if (!name){ // I don't really like this...
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

	// Why the constants, at least for to?
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

	toJSON(){
		return {
			query: this.query,
			params: this.params,
			method: this.method,
			content: this.content,
			permissions: this.permissions
		};
	}
}

module.exports = {
	Context
};
