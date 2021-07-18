
const {Broadcast} = require('bmoor/src/eventing/broadcast.js');
const {Manager} = require('bmoor/src/eventing/manager.js');

// messaging bus for effects
class Bus {
	constructor(){
		this.broadcast = new Broadcast();
		this.manager = new Manager(this.broadcast);
	}

	async triggerEvent(model, event, args){
		return this.broadcast.trigger(`${model}.${event}`, ...args);
	}

	async debounceEvent(model, event, key, args){
		return this.manager.trigger(`${model}.${event}`, key, args);
	}

	async addListener(model, event, cb){
		return this.broadcast.on(`${model}.${event}`, cb);
	}
}

module.exports = {
	Bus
};
