
const {Structure} = require('./structure.js');
const {Query} = require('./query.js');

const {Config} = require('bmoor/src/lib/config.js');

const major = Symbol('major');
const minor = Symbol('minor');
const none = Symbol('none');

const config = new Config({
	changeTypes: {
		major,
		minor,
		none
	},
	changeRankings: {
		[major]: 2,
		[minor]: 1,
		[none]: 0
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

function buildValidator(validation){
	console.log(validation);
}

function buildChangeCompare(old, field, type){
	if (old){
		return function(delta){
			return compareChanges(
				old(delta),
				field.externalGetter(delta) === undefined ? null : type
			);
		};
	} else {
		return function(delta){
			return field.externalGetter(delta) === undefined ? 
				config.get('changeTypes.none') : type;
		};
	}
}

function buildSettings(properties, field){
	const path = field.path;

	const settings = field.incomingSettings;

	if (settings.create){
		properties.create.push(path);
	}

	if (settings.read){
		properties.read.push(path);
	}

	if (settings.update){
		properties.update.push(path);

		if (settings.updateType){
			properties.updateType[path] = settings.updateType;
		}
	}

	if (settings.index){
		properties.index.push(path);
	}

	if (settings.query){
		properties.query.push(path);
	}

	if (settings.key){
		if (properties.key){
			throw new Error(`bmoor-data.Structure does not support compound keys: (${properties.key}, ${path})`);
		}

		properties.key = path;
	}

	if (settings.validation){
		properties.validation[path] = buildValidator(settings.validation);
	}

	if (settings.updateType){
		properties.calculateChangeType = buildChangeCompare(
			properties.calculateChangeType,
			field,
			settings.updateType
		);
	}

	return properties;
}

class Model extends Structure {
	async build(){
		await super.build();

		if (!this.settings){
			this.settings = this.fields.reduce(buildSettings, {
				create: [],
				read: [],
				update: [],
				updateType: {},
				key: null,
				index: [],
				query: [],
				validation: {},
				calculateChangeType: null
			});
		}
	}

	async configure(settings){
		await super.configure(settings);

		this.settings = null;
		this.schema = settings.schema || this.name;
		this.connector = settings.connector;

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

	clean(type, datum){
		if (!this.settings){
			this.build();
		}

		return this.settings[type]
		.reduce(
			(agg, field) => {
				if (field in datum){
					agg[field] = datum[field];
				}

				return agg;
			}, 
			{}
		);
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
		if (this.settings.calculateChangeType){
			return this.settings.calculateChangeType(delta);
		} else {
			return config.get('changeTypes.none');
		}
	}

	// produces representation for interface layer
	// similar to lookup, which is a combination of models
	// TODO: sort-by, limit
	// TODO: where to add ability to join from another model?
	async getQuery(settings, ctx){
		const query = settings.baseQuery || new Query(this.name);

		query.setSchema(this.name, this.schema);

		return super.getQuery(
			{
				query: query,
				joins: settings.joins,
				params: settings.params
			},
			ctx
		);
	}
}

module.exports = {
	config,
	buildSettings,
	compareChanges,
	Model
};
