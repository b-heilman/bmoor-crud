
// this is our building object, it produces all the things exposing in the system
class Gateway {
	constructor(nexus){
		this.nexus = nexus;
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

	async installActions(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				return this.nexus.configureAction(ref, settings);
			})
		);
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

	async installSynthetics(instructions){
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				return this.nexus.configureSynthetic(ref, settings);
			})
		);
	}

	async install(cfg){
		const [guards, actions, utilities, synthetics] = await Promise.all([
			this.installGuards(cfg.get('guards')||[]),
			this.installActions(cfg.get('actions')||[]),
			this.installUtilities(cfg.get('utilities')||[]),
			this.installSynthetics(cfg.get('synthetics')||[])
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
