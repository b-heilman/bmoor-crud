class Executor {
	constructor(name, executable) {
		this.name = name;
		this.executable = executable;
	}

	async link(nexus) {
		// this means, for now, executables have to be simple... since I didn't
		// allow joins, this is fine
		const executable = this.executable;

		this.source = await nexus.loadSource(
			executable.baseSeries.model.incomingSettings.source
		);

		return this;
	}

	async run(ctx) {
		return this.source.execute(this.executable, ctx);
	}

	toJSON() {
		const executable = this.executable;
		const rtn = executable.toJSON();

		rtn.sourceName = executable.baseSeries.model.incomingSettings.source;

		return rtn;
	}
}

module.exports = {
	Executor
};
