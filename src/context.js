
class Context {
	constructor(systemContext = {}){
		this.ctx = systemContext;
		this.query = systemContext.query;
		this.params = systemContext.params;
		this.method = systemContext.method.toLowerCase();
		this.content = systemContext.content || {};

		this.changes = {};
	}

	async hasPermission(/*permission*/){
		return true;
	}

	// method

	// params
	getParam(name){
		if (this.params && name in this.params){
			return this.params[name];
		} else {
			return null;
		}
	}

	// query
	getQuery(name){
		if (this.query && name in this.query){
			return this.query[name];
		} else {
			return null;
		}
	}

	async getContent(){
		return this.content;
	}

	async getFile(){
		return null;
	}

	addChange(model, action, datum){
		let modelInfo = this.changes[model];

		if (!modelInfo){
			modelInfo = [];

			this.changes[model] = modelInfo;
		}

		modelInfo.push({
			action,
			datum
		});
	}

	getChanges(){
		return this.changes;
	}
}

module.exports = {
	Context
};
