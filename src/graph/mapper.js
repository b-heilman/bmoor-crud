
const {Hub} = require('./hub.js');

class Mapper {
	constructor(){
		this.clear();
	}

	clear(){
		this.links = {};
	}

	addModel(model){
		const fields = model.incomingSettings.fields;
		
		for (let property in fields){
			let field = fields[property];

			if (field.link){
				this.addLink(model.name, property, field.link.name, field.link.field);
			}
		}
	}

	addLink(fromTable, fromPath, toTable, toPath){
		const from = this.links[fromTable] || (this.links[fromTable] = new Hub(fromTable));

		from.addLink(fromPath, toTable, toPath, {
			direction: 'outgoing'
		});

		const to = this.links[toTable] || (this.links[toTable] = new Hub(toTable));

		to.addLink(toPath, fromTable, fromPath, {
			direction: 'incoming'
		});
	}

	getLink(name){
		return this.links[name];
	}

	getByDirection(name, direction){
		return this.links[name].connections
		.filter(d => d.metadata.direction === direction);
	}

	getRelationships(fromName){
		const link = this.getLink(fromName);

		if (link){
			return link.connections;
		}

		return null;
	}

	getRelationship(fromName, toName, fromField=null, toField=null){
		const link = this.getLink(fromName);

		if (link){
			return link.getConnection(toName, fromField, toField);
		}

		return null;
	}
}

module.exports = {
	Mapper
};
