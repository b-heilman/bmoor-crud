
const {Linker} = require('./linker.js');

// Builds a network give a mapper
class Network {
	constructor(mapper){
		this.mapper = mapper;
	}

	// given a set of targets, see if they all connect, limiting depth of search
	// this is pretty brute force
	search(toSearch, count = 999){
		// reduce all names to the links for them
		const models = [...new Set(toSearch)]; // make unique

		if (models.length === 1){
			// I feel a little dirty for this... but...
			return [{
				name: models[0]
			}];
		}

		const contains = models.reduce(
			(agg, name, i) => {
				const linker = new Linker(this.mapper, name);

				// run only the following names, it's n!, but the ifs reduce n
				models.slice(i+1)
				.forEach(nextName => {
					let results = linker.search(nextName, count);

					if (results){
						results.forEach(link => {
							if (name !== link.name){
								agg[name] = linker.link;

								if (!agg[link.name]){
									agg[link.name] = link;	
								}
							}
						});
					}
				});

				return agg;
			},
			models.reduce(
				(agg, name) => {
					agg[name] = null;

					return agg;
				},
				{}
			)
		);

		// Do a last can, make sure all links were defined... ensuring all
		// tables are linked
		return Object.keys(contains)
		.map(key => {
			const link = contains[key];

			if (!link){
				throw new Error('unlinked target: '+key);
			}

			return link;
		});
	}

	// orders links in a order the ensures requirements come first 
	requirements(toSearch, count = 3){
		let links = this.search(toSearch, count);

		if (links.length === 1){
			return links;
		}

		const found = [];

		// keep rotating through the network, pulling off the edges
		// I can do this, because the base requirement will have none itself
		while(links.length){
			const origLength = links.length;
			const names = links.map(link => link.name);

			links = links.filter(link => {
				if (link.search('direction', 'outgoing', names).length === 0){
					found.push(link);
					
					return false;
				} else {
					return true;
				}
			});

			if (links.length === origLength){
				throw new Error('unable to reduce further');
			}
		}
		
		return found;
	}

	// orders with the most linked to node first, and then moves to the leaves
	anchored(toSearch, count = 3){
		const links = this.search(toSearch, count);

		if (links.length === 1){
			return links;
		}

		const dex = links.reduce(
			(agg, link) => {
				agg[link.name] = link;

				return agg;
			},
			{}
		);
		const names = Object.keys(dex);

		const priority = links.map(
			link => ({
				link,
				connections: link.prune(names)
			})
		).sort((a, b) => b.connections.length - a.connections.length); // I want higher counts first

		const name = priority.shift().link.name;
		const rtn = [dex[name]];
		const next = [dex[name]];

		delete dex[name];

		while(next.length){
			const node = next.shift();
			const connections = node.prune(Object.keys(dex));

			connections.forEach(link => {
				const needed = dex[link.name];
				if (needed){
					rtn.push(needed);

					delete dex[link.name];

					next.push(needed);
				}
			});
		}

		return rtn;
	}
}

module.exports = {
	Network
};
