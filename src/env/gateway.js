// this is our building object, it produces all the things exposing in the system
const {Querier} = require('../controllers/querier.js');

class Gateway {
	constructor(nexus) {
		this.nexus = nexus;
	}

	async installGuards(instructions) {
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				return this.nexus.configureGuard(ref, settings);
			})
		);
	}

	async installActions(instructions) {
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				return this.nexus.configureAction(ref, settings);
			})
		);
	}

	async installUtilities(instructions) {
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				return this.nexus.configureUtility(ref, settings);
			})
		);
	}

	async installSynthetics(instructions) {
		return Promise.all(
			instructions.map(async (rule) => {
				const ref = rule.name;
				const settings = rule.settings;

				return this.nexus.configureSynthetic(ref, settings);
			})
		);
	}

	async installQuerier() {
		return new Querier(this.nexus);
	}

	async install(settings) {
		const [guards, actions, utilities, synthetics, querier] = await Promise.all(
			[
				this.installGuards(settings.guards || []),
				this.installActions(settings.actions || []),
				this.installUtilities(settings.utilities || []),
				this.installSynthetics(settings.synthetics || []),
				this.installQuerier()
			]
		);

		this.guards = guards;
		this.actions = actions;
		this.utilities = utilities;
		this.synthetics = synthetics;
		this.querier = querier;

		return {
			guards,
			actions,
			utilities,
			synthetics,
			querier
		};
	}
}

module.exports = {
	Gateway
};
