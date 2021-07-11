
const {Structure} = require('./structure.js');
const {Query} = require('./query.js');

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

	return properties;
}

class Model extends Structure {
	async build(){
		if (!this.settings){
			await super.build();

			Object.assign(this.settings, {
				create: [],
				read: [],
				update: [],
				updateType: {},
				key: null,
				index: [],
				query: []
			});

			this.fields.reduce(buildSettings, this.settings);
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

	// produces representation for interface layer
	// similar to lookup, which is a combination of models
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
	buildSettings,
	Model
};
