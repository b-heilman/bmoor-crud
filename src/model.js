
const {Schema} = require('./schema.js');

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

class Model extends Schema {
	constructor(name, settings) {
		super();
		
		this.name = name;
		this.schema = settings.schema || name;
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

			// I'm doing this for the future, but I'm not fully fleshing out out
			// right now
			field.model = this;
			
			field.external = property;

			if (!field.internal){
				field.internal = property;
			}

			this.addField(field);
		}

		this.build();
	}

	getKey(delta){
		return delta[this.properties.key];
	}

	hasIndex(){
		return this.properties.index.length !== 0;
	}

	// TODO : I need to get rid of these
	cleanIndex(query){ // getIndex
		return this.clean('index', query);
	}

	cleanQuery(query){ // getQuery
		return this.clean('query', query);
	}

	cleanDelta(delta, type='update'){
		return this.clean(type, delta);
	}

	getChanges(datum, delta){
		delta = this.clean('update', delta);

		return this.properties.update
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
			(agg, property) => compareChanges(agg, this.properties.updateType[property]),
			null
		);
	}

	// produces representation for interface layer
	// similar to lookup, which is a combination of models
	async getQuery(query, settings, ctx){
		const fields = (await this.testFields('read', ctx))
		.map(
			field => ({
				path: field.internal
			})
		);

		return {
			models: [{
				name: this.name,
				schema: this.schema,
				fields,
				query //TODO : maybe convert external => internal?
			}]
		};
	}
}

module.exports = {
	config,
	compareChanges,
	Model
};
