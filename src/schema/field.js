
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
		this.incomingSettings = settings;
	}

	extend(path, settings){
		const ops = Object.assign({},this.incomingSettings, settings);
		ops.storagePath = this.storagePath;

		const field = new Field(
			path, 
			this.structure,
			ops	
		);

		field.original = this.original || this;

		return field;
	}

	toJSON(){
		return {
			path: this.path,
			storage: {
				schema: this.structure.name,
				path: this.storagePath
			},
			usage: {
				type: this.incomingSettings.jsonType,
				description: this.incomingSettings.description
			}
		};
	}
}

module.exports = {
	config,
	Field
};
