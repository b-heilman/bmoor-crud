const {Structure} = require('./structure.js');
const {QueryStatement} = require('./query/statement.js');
const {ExecutableStatement} = require('./executable/statement.js');

function buildSettings(properties, field) {
	const path = field.path;

	const settings = field.incomingSettings;

	if (settings.create) {
		properties.create.push(path);
	}

	if (settings.read) {
		properties.read.push(path);
	}

	if (settings.update) {
		properties.update.push(path);

		if (settings.updateType) {
			properties.updateType[path] = settings.updateType;
		}
	}

	if (settings.index) {
		properties.index.push(path);
	}

	if (settings.query) {
		properties.query.push(path);
	}

	if (settings.key) {
		if (properties.key) {
			throw new Error(
				`bmoor-data.Structure does not support compound keys: (${properties.key}, ${path})`
			);
		}

		properties.key = path;
	}

	return properties;
}

class Model extends Structure {
	async build() {
		if (!this.settings) {
			await super.build();

			Object.assign(this.settings, {
				create: [],
				read: [],
				update: [],
				updateType: {},
				key: null,
				index: [],
				query: []
			});

			this.fields.reduce(buildSettings, this.settings);
		}
	}

	async configure(settings) {
		await super.configure(settings);

		this.schema = settings.schema || this.name;
		this.settings = null;

		const fields = settings.fields;

		for (let property in fields) {
			let field = fields[property];

			if (field === true) {
				field = {
					create: true,
					read: true,
					update: true
				};
			} else if (field === false) {
				field = {
					create: false,
					read: true,
					update: false
				};
			}

			this.addField(property, field);
		}

		await this.build();

		this.preparedQuery = await this.prepareBaseQuery();
		this.preparedExecutable = await this.prepareBaseExecutable();
	}

	getKeyField() {
		return this.settings.key;
	}

	getKey(delta) {
		if (!delta) {
			throw new Error('Can not getKey of undefined delta');
		}

		return delta[this.settings.key];
	}

	hasIndex() {
		return this.settings.index.length !== 0;
	}

	clean(type, datum) {
		if (!this.settings) {
			this.build();
		}

		return this.settings[type].reduce((agg, field) => {
			if (field in datum) {
				agg[field] = datum[field];
			}

			return agg;
		}, {});
	}

	cleanDelta(delta, type = 'update') {
		return this.clean(type, delta);
	}

	getChanges(datum, delta) {
		delta = this.clean('update', delta);

		return this.settings.update.reduce((agg, field) => {
			if (field in delta && datum[field] !== delta[field]) {
				agg[field] = delta[field];
			}

			return agg;
		}, {});
	}

	getBaseExecutable() {
		return new ExecutableStatement(this.name);
	}

	async prepareBaseExecutable() {
		const exe = this.getBaseExecutable();

		exe.setModel(this.name, this);

		await this.extendBaseStatement(exe);

		return exe;
	}

	async getExecutable(method, settings, ctx) {
		const exe = this.preparedExecutable.clone();

		exe.setMethod(method);

		if (settings.payload) {
			exe.setPayload(this.name, settings.payload);
		}

		await this.extendStatement(
			exe,
			{
				params: settings.params
			},
			ctx
		);

		return exe;
	}

	getBaseQuery() {
		return new QueryStatement(this.name);
	}

	async prepareBaseQuery() {
		const query = await super.prepareBaseQuery();

		query.setModel(this.name, this);

		return query;
	}

	// produces representation for interface layer
	// similar to lookup, which is a combination of models
	async getQuery(settings, ctx) {
		const query = this.preparedQuery.clone();

		return this.extendQuery(
			query,
			{
				joins: settings.joins,
				query: settings.query,
				params: settings.params,
				sort: settings.sort
			},
			ctx
		);
	}
}

module.exports = {
	buildSettings,
	Model
};
