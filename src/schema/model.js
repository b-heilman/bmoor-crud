
const {Structure} = require('./structure.js');

const {Config} = require('bmoor/src/lib/config.js');

const major = Symbol('major');
const minor = Symbol('minor');

const config = new Config({
	changeTypes: {
		major,
		minor
	},
	changeRankings: {
		[major]: 2,
		[minor]: 1
	}
});

function compareChanges(was, now){
	if (now){
		if (!was){
			return now; 
		} else {
			const rankings = config.get('changeRankings');

			if (rankings[now] > rankings[was]){
				return now;
			}
		}
	}

	return was;
}

class Model extends Structure {
	async configure(settings){
		await super.configure(settings);

		this.schema = settings.schema || this.name;
		this.settings = settings;

		const fields = settings.fields;

		for (let property in fields){
			let field = fields[property];

			if (field === true){
				field = {
					create: true,
					read: true,
					update: true
				};
			} else if (field === false){
				field = {
					create: false,
					read: true,
					update: false
				};
			}

			this.addField(property, field);
		}

		return this.build();
	}

	getKey(delta){
		return delta[this.settings.key];
	}

	hasIndex(){
		return this.settings.index.length !== 0;
	}

	cleanDelta(delta, type='update'){
		return this.clean(type, delta);
	}

	getChanges(datum, delta){
		delta = this.clean('update', delta);

		return this.settings.update
		.reduce(
			(agg, field) => {
				if (field in delta && datum[field] !== delta[field]){
					agg[field] = delta[field];
				}

				return agg;
			},
			{}
		);
	}

	getChangeType(delta){
		return Object.keys(this.clean('update', delta))
		.reduce(
			(agg, property) => compareChanges(agg, this.settings.updateType[property]),
			null
		);
	}

	// produces representation for interface layer
	// similar to lookup, which is a combination of models
	// TODO: sort-by, limit
	// TODO: where to add ability to join from another model?
	async getQuery(settings, ctx){
		const fields = (await this.testFields('read', ctx))
		.map(
			field => ({
				path: field.storagePath
			})
		);

		return {
			models: [{
				name: this.name,
				schema: this.schema,
				fields,
				query: settings.params //TODO : maybe convert external => internal?
			}].concat(settings.join||[])
		};
	}
}

module.exports = {
	config,
	compareChanges,
	Model
};
