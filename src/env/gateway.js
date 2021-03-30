
const loader = require('../server/loader.js');

const {Config} = require('bmoor/src/lib/config.js');

// this is our building object, it produces all the things exposing in the system
async function load(type, directories, stubs = null){
	console.log('->', type);
	if (stubs){
		const stub = stubs.get(type);

		if (stub){
			console.log('=>', stub);
			return stub;
		}
	}

	return loader.loadFiles(directories.get(type));
}

class Gateway {
	constructor(nexus){
		this.nexus = nexus;

		this.installations = new Config({});
	}

	async installGuards(directories, stubs){
		return Promise.all(
			(await load('guard', directories, stubs))
			.map(file => this.nexus.setGuard(file.name, file.settings))
		);
	}

	async installActions(directories, stubs){
		return Promise.all(
			(await load('action', directories, stubs))
			.map(file => this.nexus.setAction(file.name, file.settings))
		);
	}

	async installUtilities(directories, stubs){
		return Promise.all(
			(await load('utility', directories, stubs))
			.map(file => this.nexus.setUtility(file.name, file.settings))
		);
	}

	async installSynthetics(directories, stubs){
		return Promise.all(
			(await load('synthetic', directories, stubs))
			.map(file => this.nexus.setSynthetic(file.name, file.settings))
		);
	}

	async install(directories, stubs){
		const [guards, actions, utilities, synthetics] = await Promise.all([
			this.installGuards(directories, stubs),
			this.installActions(directories, stubs),
			this.installUtilities(directories, stubs),
			this.installSynthetics(directories, stubs)
		]);

		this.guards = guards;
		this.actions = actions;
		this.utilities = utilities;
		this.synthetics = synthetics;

		return {
			guards,
			actions,
			utilities,
			synthetics
		};
	}
}

module.exports = {
	Gateway
};
