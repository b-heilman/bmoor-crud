
const {Config} = require('bmoor/src/lib/config.js');
const {makeGetter, makeSetter} = require('bmoor/src/core.js');

const config = new Config({
});

class Field {
	constructor(path, structure, settings) {
		// path should always be considered an unique identifier
		this.path = path;
		this.series = settings.series || structure.name;
		this.storagePath = settings.storagePath || path;
		// using storage path can cause collisions on composites, path should
		// still be unique.  By writing back to the path I can later optimize
		// by just inflating the returned response or something else
		this.reference = settings.reference || path;

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

		this.externalGetter = makeGetter(this.path);
		this.externalSetter = makeSetter(this.path);
		this.internalGetter = makeGetter(this.reference);
		this.internalSetter = makeSetter(this.storagePath);
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
				//name: this.incomingSettings.usage,
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
