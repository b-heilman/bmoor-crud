
const {Broadcast} = require('bmoor/src/eventing/broadcast.js');

// messaging bus for effects
class Bus {
	constructor(){
		this.broadcast = new Broadcast();
	}

	async triggerEvent(model, event, datum, ctx){
		return this.broadcast.trigger(`${model}.${event}`, datum, ctx);
	}

	async addListener(model, event, cb){
		return this.broadcast.on(`${model}.${event}`, cb);
	}
}

module.exports = {
	Bus
};
