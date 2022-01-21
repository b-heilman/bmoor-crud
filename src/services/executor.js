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
			executable.models[executable.base].model.incomingSettings.source
		);

		return this;
	}

	async run(ctx) {
		return this.source.execute(this.executable, ctx);
	}

	toJSON() {
		const rtn = this.executable.toJSON();

		rtn.sourceName = this.models[this.base].model.incomingSettings.source;

		return rtn;
	}
}

module.exports = {
	Executor
};
