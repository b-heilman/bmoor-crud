const {Querier} = require('./querier.js');
const {Executor} = require('./executor.js');
const {ViewActions} = require('./view/actions.js');

async function runFilter(arr, view, ctx) {
	const filterFn = await view.buildFilter(ctx);

	if (filterFn) {
		return arr.filter(filterFn);
	} else {
		return arr;
	}
}

class View {
	constructor(structure) {
		this.structure = structure;
		this.cleaners = {};
		this.hooks = {};
		this.security = {};

	}

	async configure(settings = {}) {
		this.incomingSettings = settings;
	}

	async build(){
		await this.structure.build();

		/***
		 * Here's how permissions / security will work.  I am going to treat
		 * the framework like a red/green network topography.  Everything
		 * services and schemas will be assumed sanitized, and controllers
		 * will sanitize any incoming things.  This reduces the number of 
		 * unneccisary copies made of data. So cleanFor are used to apply permissions
		 * to a known data shape and copyFor is to sanitize data from the outside.
		 * 
		 * Deflate will act as a copyFor, so I don't need one for create or update
		 ***/
		this.actions = new ViewActions(
			this.structure.actions,
			this.incomingSettings
		);
	}

	// TODO: this needs to be redone as well
	async buildFilter(ctx) {
		if (this.security.filterFactory) {
			return this.security.filterFactory(ctx);
		} else {
			return null;
		}
	}

	async run(stmt, ctx, settings) {
		await stmt.link(this.structure.nexus);

		return stmt.run(ctx, settings);
	}

	async process(stmt, ctx, settings={}) {
		const actions = settings.actions || this.actions;

		return runFilter(
			await Promise.all(
				// converts from internal => external
				(await this.run(stmt, ctx, settings)).map(
					async (datum) => actions.inflate(datum, ctx)
				)
			),
			this,
			ctx
		);
	}

	async query(query, ctx, settings = {}) {
		return this.process(
			new Querier('view:' + this.structure.name, query),
			ctx,
			settings
		);
	}

	async execute(exe, ctx, settings = {}) {
		return this.process(
			new Executor('view:' + this.structure.name, exe),
			ctx,
			settings
		);
	}

	async getChangeType(datum, id = null, ctx = null) {
		let delta = datum;

		if (id) {
			const target = await this.read(id, ctx);

			if (target) {
				delta = this.structure.getFields().reduce((agg, field) => {
					const incomingValue = field.externalGetter(datum);
					const existingValue = field.externalGetter(target);

					if (incomingValue !== existingValue && incomingValue !== undefined) {
						field.externalSetter(agg, incomingValue);
					}

					return agg;
				}, {});
			}
		}

		return this.structure.getChangeType(delta);
	}

	// TODO: revisit this...
	async validate(delta, mode, ctx) {
		const security = this.security;

		const errors = this.structure.validate(delta, mode);

		return security.validate
			? errors.concat(await security.validate(delta, mode, ctx))
			: errors;
	}

	toJSON() {
		return {
			$schema: 'bmoor-crud:view',
			structure: this.structure
		};
	}
}

module.exports = {
	runFilter,
	View
};
