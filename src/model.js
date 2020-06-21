
const {Config} = require('bmoor/src/lib/config.js');

const types = new Config();

/**
tableLink: {
	name:
	field:	
}

fieldDef: {
	-- crud operations
	create
	read
	update

	-- 
	key: // is a primary key
	index: // can be used as a unique index
	query: // fields allowed to be queries on

	-- structure
	link: <tableLink> // if a foreign key
	internal: ''  TODO : internal structure
}

fields: {
	[externalPath]: <fieldDef>
}

model: {
	name: '',
	type: '',
	fields: <fields>
}
**/

function actionExtend(op, property, old){
	return function(datum, ctx){
		datum[property] = op(old(op, ctx), ctx);
		return datum;
	};
}

function buildProperties(properties, property, field){
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

	if (field.type){
		// this allows types to define onCreate, onRead, onUpdate, onDelete
		Object.assign(field, types.get(field.type)||{});
	}

	if (field.create){
		properties.create.push(property);
	}

	if (field.onCreate){
		properties.onCreate = actionExtend(field.onCreate, property, properties.onCreate);
	}

	if (field.read){
		properties.read.push(property);
	}

	if (field.onRead){
		properties.onRead = actionExtend(field.onRead, property, properties.onRead);
	}

	if (field.update){
		properties.update.push(property);

		if (field.updateType){
			properties.updateType[property] = field.updateType;
		}
	}

	if (field.onUpdate){
		properties.onUpdate = actionExtend(field.onUpdate, property, properties.onUpdate);
	}

	if (field.index){
		properties.index.push(property);
	}

	if (field.query){
		properties.query.push(property);
	}

	if (field.key){
		if (properties.key){
			throw new Error(`bmoor-data.Model does not support compound keys: (${properties.key}, ${property})`);
		}

		properties.key = property;
	}
}

function onCreate(obj){
	return obj;
}

function onRead(obj){
	return obj;
}

function onUpdate(obj){
	return obj;
}

function compileProperties(fields){
	const properties = {
		create: [],
		onCreate, 
		read: [],
		onRead,
		update: [],
		updateType: {},
		onUpdate,
		key: null,
		index: [],
		query: []
	};

	for (let property in fields){
		let field = fields[property];

		buildProperties(properties, property, field);
	}

	return properties;
}

class Model {
	constructor(name, settings) {
		this.name = name;
		this.settings = settings;

		// define structure
		this.properties = compileProperties(settings.fields);
	}

	getKey(delta){
		return delta[this.properties.key];
	}

	hasIndex(){
		return this.properties.index.length !== 0;
	}

	getIndex(query){
		return this.properties.index
		.reduce(
			(agg, field) => {
				agg[field] = query[field];

				return agg;
			},
			{}
		);
	}

	getQuery(query){
		return this.properties.query
		.reduce(
			(agg, field) => {
				if (field in query){
					agg[field] = query[field];
				}

				return agg;
			},
			{}
		);
	}

	cleanDelta(delta, type = 'update'){
		return this.properties[type]
		.reduce((agg, field) => {
			if (field in delta){
				agg[field] = delta[field];
			}

			return agg;
		}, {});
	}

	getChanges(datum, delta){
		delta = this.cleanDelta(delta);

		return this.properties.update
		.reduce((agg, field) => {
			if (field in delta && datum[field] !== delta[field]){
				agg[field] = delta[field];
			}

			return agg;
		}, {});
	}

	getChangeType(delta){
		const changes = Object.keys(this.cleanDelta(delta))
		.reduce((agg, property) => {
			const type = this.properties.updateType[property];

			if (type){
				agg[type] = property;
			}

			return agg;
		}, {});

		if (Object.keys(changes).length){
			return changes;
		} else {
			return null;
		}
	}
}

module.exports = {
	Model,
	types
};
