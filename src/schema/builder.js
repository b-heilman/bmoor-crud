
const {set} =  require('bmoor/src/core.js');

class Value{
	constructor(value){
		this.value = value;
	}

	toJSON(){
		return this.value;
	}
}

class Builder{
	constructor(content = {}){
		this.content = content;
		this.holders = 0;
	}

	getPlaceHolder(){
		return new Value('ref-'+(this.holders++));
	}

	set(path, value){
		set(this.content, path, value);
	}

	toJSON(){
		return this.content;
	}
}

module.exports = {
	Value,
	Builder
};
