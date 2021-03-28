
const loader = require('../server/loader.js');

const {Config} = require('bmoor/src/lib/config.js');

// this is our building object, it produces all the things exposing in the system
class Gateway {
	constructor(nexus){
		this.nexus = nexus;

		this.installations = new Config({});
	}

	async getSettings(directory){
		return Promise.all(
			(await loader.getFiles(directory)).map(
				async (file) => {
					file.settings = await loader.getSettings(file.path);

					return file;
				}
			)
		);
	}

	async installGuards(directories){
		return Promise.all(
			(await this.getSettings(directories.get('guard')))
			.map(file => this.nexus.setGuard(file.name, file.settings))
		);
	}

	async installActions(directories){
		return Promise.all(
			(await this.getSettings(directories.get('action')))
			.map(file => this.nexus.setAction(file.name, file.settings))
		);
	}

	async installUtilities(directories){
		return Promise.all(
			(await this.getSettings(directories.get('utility')))
			.map(file => this.nexus.setUtility(file.name, file.settings))
		);
	}

	async installSynthetics(directories){
		return Promise.all(
			(await this.getSettings(directories.get('synthetic')))
			.map(file => this.nexus.setSynthetic(file.name, file.settings))
		);
	}

	async install(directories){
		const [guards, actions, utilities, synthetics] = await Promise.all([
			this.installGuards(directories),
			this.installActions(directories),
			this.installUtilities(directories),
			this.installSynthetics(directories)
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
