
const loader = require('../server/loader.js');

const {Config} = require('bmoor/src/lib/config.js');

// this is our building object, it produces all the things exposing in the system
class Gateway {
	constructor(nexus){
		this.nexus = nexus;

		this.installations = new Config({});
	}

	async install(directories){
		const [guards, actions, utilities, synthetics] = await Promise.all([
			Promise.all((await loader.getFiles(directories.get('guard'))).map(
				async (file) => {
					const settings = await loader.getSettings(file.path);

					return this.nexus.setGuard(file.name, settings);
				}
			)),
			Promise.all((await loader.getFiles(directories.get('action'))).map(
				async (file) => {
					const settings = await loader.getSettings(file.path);

					return this.nexus.setAction(file.name, settings);
				}
			)),
			Promise.all((await loader.getFiles(directories.get('utility'))).map(
				async (file) => {
					const settings = await loader.getSettings(file.path);

					return this.nexus.setUtility(file.name, settings);
				}
			)),
			Promise.all((await loader.getFiles(directories.get('synthetic'))).map(
				async (file) => {
					const settings = await loader.getSettings(file.path);

					return this.nexus.setSynthetic(file.name, settings);
				}
			))
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
