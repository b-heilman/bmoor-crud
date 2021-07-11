
class Cache {
	constructor(){
		this.memory = new Map();
	}

	set(table, key, datum){
		if (!this.memory.has(table)){
			this.memory.set(table, new Map());
		}

		this.memory.get(table).set(key, datum);

		return datum;
	}

	has(table, key){
		return this.memory.has(table) && this.memory.get(table).has(key);
	}

	get(table, key){
		const group = this.memory.get(table);

		if (group){
			return group.get(key);
		}
	}
}

module.exports = {
	Cache
};
