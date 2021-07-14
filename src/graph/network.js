
const {Linker} = require('./linker.js');

// Builds a network give a mapper
class Network {
	constructor(mapper){
		this.mapper = mapper;
	}

	// given a set of targets, see if they all connect, limiting depth of search
	// this is pretty brute force
	search(toSearch, depth = 999, settings={}){
		const joinModels = Object.keys(settings.join||[]).reduce(
			(agg, model) => {
				const tables = settings.join[model];

				return tables.reduce(
					(inner, table) => {
						let incoming = inner[table];

						if (!incoming){
							incoming = {};

							inner[table] = incoming;
						}
						
						incoming[model] = true;

						return inner;
					},
					agg
				);
			}, 
			{}
		);
		
		const stubModels = (settings.stub||[]).reduce(
			(agg, table) => {
				agg[table] = true;

				return agg;
			},
			{}
		);

		// reduce all names to the links for them
		let models = [...new Set(toSearch)]; // make unique

		if (models.length === 1){
			// I feel a little dirty for this... but...
			return [{
				name: models[0]
			}];
		}

		let contains = models.reduce(
			(agg, name) => {
				agg[name] = null;

				return agg;
			},
			{}
		);

		const masterModels = models;
		const fnFactory = (depthTarget) => {
			return (agg, name, i) => {
				const linker = new Linker(this.mapper, name);

				// if stubbed, no linking out
				if (stubModels[name]){
					return agg;
				}

				// run only the following names, it's n!, but the ifs reduce n
				masterModels.slice(i+1)
				.forEach(nextName => {
					let results = linker.search(nextName, depthTarget, {
						allowed: joinModels,
						block: stubModels
					});

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
			};
		};

		const filterFn = key => !contains[key];

		for(let depthPos = 1;  depthPos <= depth; depthPos++){
			contains = models.reduce(fnFactory(depthPos), contains);

			if (Object.values(contains).indexOf(null) === -1){
				depthPos = depth;
			}

			models = Object.keys(contains).filter(filterFn);
		}

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
	// TODO: need to abstract this function to a common directed graph sort
	requirements(toSearch, depth = 3){
		let links = this.search(toSearch, depth);

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
	anchored(toSearch, depth = 3){
		const links = this.search(toSearch, depth);

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

	path(fromName, toName, toSearch, depth = 3){
		const links = this.search(toSearch, depth);

		if (links.length === 1){
			return links;
		}

		const dex = links.reduce(
			(agg, link) => {
				agg[link.name] = {
					link,
					connections: []
				};

				return agg;
			},
			{}
		);

		const names = Object.keys(dex);

		Object.values(dex)
		.forEach(info => {
			info.connections = info.link.prune(names);
		});

		const cur = dex[fromName];
		delete dex[fromName];

		if (fromName === toName){
			return [cur.link];
		}

		let search = [{
			node: cur,
			path: [cur.link]
		}];

		while(search.length){
			const {node, path} = search.shift();
			
			for (let i = 0; i < node.connections.length; i++){
				const link = node.connections[i];
				const cur = dex[link.name];

				if (cur){
					const slice = path.slice(0);

					slice.push(cur.link);

					if (link.name === toName){
						return slice;
					} else {
						delete dex[link.name];

						search.push({
							node: cur,
							path: slice
						});
					}
				}
			}
		}
	}
}

module.exports = {
	Network
};
