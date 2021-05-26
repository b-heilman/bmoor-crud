
const {Config} = require('bmoor/src/lib/config.js');
const {Broadcast} = require('bmoor/src/eventing/broadcast.js');

const config = new Config({
	timeout: 1000
});

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

	async await(modelName, ref){
		const waiting = this.getModel(modelName);

		let rtn = waiting[ref];

		if (!rtn){
			rtn = new Promise((resolve, reject) => {
				const looking = `${modelName}.${ref}`;
				const timeout = config.get('timeout');

				const clear = setTimeout(function(){
					reject(new Error('waitlist timed out: '+looking));
				}, timeout);

				this.broadcast.once(looking, function(info){
					clearTimeout(clear);
					
					resolve(info);
				});
			});

			waiting[ref] = rtn;
		}

		return rtn;
	}

	async resolve(service, ref, datum){
		const modelName = service.structure.name;
		const waiting = this.getModel(modelName);

		const response = {
			service,
			datum,
			key: service.structure.getKey(datum)
		};

		waiting[ref] = response;

		const triggering = `${modelName}.${ref}`;
		this.broadcast.trigger(triggering, response);
	}
}

module.exports = {
	Waitlist
};
