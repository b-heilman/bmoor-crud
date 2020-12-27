
const {Config} = require('bmoor/src/lib/config.js');

const config = new Config({
});

// TODO: 2/20 - cleaners / property checks should have an api, no?
class Field {
	constructor(path, structure, settings) {
		const storagePath = settings.storagePath;

		this.path = path;
		this.storagePath = storagePath || path;
		this.reference = settings.reference || storagePath || path;
		
		this.structure = structure;
		
		/***
	     * - create
	     * - read
	     * - update
	     * - updateType
	     * - index
	     * - query
	     * - key
	     ***/
		this.settings = settings;
	}

	extend(path, settings){
		const ops = Object.assign({},this.settings, settings);
		ops.storagePath = this.storagePath;

		const field = new Field(
			path, 
			this.structure,
			ops	
		);

		field.original = this.original || this;

		return field;
	}

	toJSON(){ // TODO: change to toJSON
		return {
			path: this.path,
			storage: {
				schema: this.structure.name,
				path: this.storagePath
			},
			usage: {
				type: this.settings.jsonType,
				description: this.settings.description
			}
		};
	}
}

module.exports = {
	config,
	Field
};
