const {makeGetter} = require('bmoor/src/core.js');

// If I ever refactor, I should copy the from[name, path] + to[name, path]
class Connection {
	constructor(localPath, modelName, remotePath, metadata) {
		this.local = localPath;
		this.name = modelName;
		this.remote = remotePath;
		this.metadata = metadata;
	}

	toJson() {
		return {
			local: this.local,
			name: this.name,
			remote: this.remote,
			metadata: this.metadata
		};
	}
}

class Hub {
	constructor(name) {
		this.name = name;
		this.connections = []; // aggregrate of ALL links, even multiple links to one table
		this.connectors = {}; // quick look hash, at least one instance is there, but not all if
		// multiple fields
	}

	// joins
	reduceConnections() {
		return this.connections.map((connection) => connection.toJson());
	}

	// hash
	reduceConnectors() {
		return Object.keys(this.connectors).reduce((agg, key) => {
			agg[key] = this.connectors[key].map((connection) => connection.toJson());

			return agg;
		}, {});
	}

	addLink(local, name, remote, metadata = {}) {
		const existing = this.connectors[name];

		const connection = new Connection(local, name, remote, metadata);

		if (!existing) {
			this.connectors[name] = [];
		}

		this.connectors[name].push(connection);
		this.connections.push(connection);
	}

	prune(subset) {
		return subset.reduce((agg, name) => {
			const subConnections = this.connectors[name];

			if (subConnections) {
				return agg.concat(subConnections);
			} else {
				return agg;
			}
		}, []);
	}

	getConnections(path, value, subset) {
		const getter = makeGetter(path);

		const connections = subset ? this.prune(subset) : this.connections;

		return connections.filter(
			(connection) => getter(connection.metadata) === value
		);
	}

	search(path, value, subset) {
		return this.getConnections(path, value, subset).map((join) => join.name);
	}

	isConnected(name) {
		return !!this.connectors[name];
	}

	connectsThrough(name) {
		const connector = this.connectors[name];

		if (connector) {
			return connector.map((link) => link.local);
		} else {
			return null;
		}
	}

	getConnection(name, viaField = null, toField = null) {
		const connector = this.connectors[name];

		if (connector) {
			if (viaField) {
				return connector.reduce((agg, link) => {
					if (agg) {
						return agg;
					}

					if (link.local === viaField) {
						if (!toField || link.remote === toField) {
							return link;
						}
					}

					return agg;
				}, null);
			} else {
				return connector[0];
			}
		} else {
			return null;
		}
	}
}

module.exports = {
	Hub,
	Connection
};
