
const loader = require('../server/loader.js');

// this is our building object, it produces all the things exposing in the system
class Gateway {
	constructor(nexus){
		this.nexus = nexus;
	}

	async load(type, directories){
		const path = directories.get(type);

		if (path){
			return loader.loadFiles(path);
		} else {
			return [];
		}
	}

	async loadGuards(directories){
		return this.load('guard', directories);
	}

	async installGuards(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				return this.nexus.configureGuard(ref, settings);
			})
		);
	}

	async loadActions(directories){
		return this.load('action', directories);
	}

	async installActions(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				return this.nexus.configureAction(ref, settings);
			})
		);
	}

	async loadUtilities(directories){
		return this.load('utility', directories);
	}

	async installUtilities(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				return this.nexus.configureUtility(ref, settings);
			})
		);
	}

	async loadSynthetics(directories){
		return this.load('synthetic', directories);
	}

	async installSynthetics(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				return this.nexus.configureSynthetic(ref, settings);
			})
		);
	}

	async install(directories, preload=null){
		const [guards, actions, utilities, synthetics] = await Promise.all([
			this.installGuards(
				(preload&&preload.get('guards')||[])
				.concat(await this.loadGuards(directories))
			),
			this.installActions(
				(preload&&preload.get('actions')||[])
				.concat(await this.loadActions(directories))
			),
			this.installUtilities(
				(preload&&preload.get('utilities')||[])
				.concat(await this.loadUtilities(directories))
			),
			this.installSynthetics(
				(preload&&preload.get('synthetics')||[])
				.concat(await this.loadSynthetics(directories))
			)
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
