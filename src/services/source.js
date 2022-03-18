class Source {
	constructor(name, nexus) {
		this.name = name;
		this.nexus = nexus;
	}

	async configure(settings) {
		this.isFlat = settings.isFlat || false;

		this.incomingSettings = settings;

		const factory = await this.nexus.loadConnector(settings.connector);

		this.connector = await factory(settings.connectorSettings);
	}

	async execute(stmt, ctx) {
		return this.connector.execute(stmt, ctx);
	}
}

module.exports = {
	Source
};
