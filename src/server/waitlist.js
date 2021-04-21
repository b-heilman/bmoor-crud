
const {Broadcast} = require('bmoor/src/eventing/broadcast.js');

class Waitlist {
	constructor(){
		this.broadcast = new Broadcast();
		this.definitions = {};
	}

	getModel(model){
		let rtn = this.definitions[model];

		if (!rtn){
			rtn = {};

			this.definitions[model] = rtn;
		}

		return rtn;
	}

	async await(model, id){
		const waiting = this.getModel(model);

		let rtn = waiting[id];

		if (!rtn){
			rtn = new Promise((resolve) => {
				this.broadcast.once(`${model}.${id}`, function(datum){
					// TODO... put a timer here;
					resolve(datum);
				});
			});

			waiting[id] = rtn;
		}

		return rtn;
	}

	async resolve(model, id, datum){
		const waiting = this.getModel(model);

		waiting[id] = datum;

		this.broadcast.trigger(`${model}.${id}`, datum);
	}
}

module.exports = {
	Waitlist
};
