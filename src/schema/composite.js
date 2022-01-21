const {implode} = require('bmoor/src/object.js');
const {create, addTrace} = require('bmoor/src/lib/error.js');
const {makeSetter} = require('bmoor/src/core.js');

const {Structure, buildParam} = require('./structure.js');

const {StatementParam} = require('./statement/param.js');
const {StatementField} = require('./statement/field.js');
const {QueryJoin} = require('./query/join.js');
const {QueryStatement} = require('./query/statement.js');
const {Instructions} = require('./composite/instructions.js');

function buildCalculations(schema, base) {
	const dynamics = implode(schema);

	return Object.keys(dynamics).reduce((old, path) => {
		const fn = dynamics[path];
		const setter = makeSetter(path);

		return function (datum, variables) {
			setter(datum, fn(old(datum, variables), variables));

			return datum;
		};
	}, base);
}

async function computeJoin(composite, join, fromModel, toModel) {
	await Promise.all([
		composite.nexus.loadModel(fromModel),
		composite.nexus.loadModel(toModel)
	]);

	if (fromModel === toModel) {
		// this is ok... right?  Nothing to do?
	} else if (join.to) {
		// the current pointer knows the target property, it gets priority
		const relationship = composite.nexus.mapper.getRelationship(
			toModel,
			fromModel,
			join.to
		);

		if (!relationship) {
			throw create(
				`composite ${composite.name}: can not connect ${fromModel} to ${toModel}`,
				{
					code: 'BMOOR_CRUD_COMPOSITE_NO_TO',
					context: {
						fromModel,
						toModel,
						join
					}
				}
			);
		}

		const actualRelationship = composite.nexus.mapper.getRelationship(
			fromModel,
			toModel,
			relationship.remote,
			relationship.local
		);

		join.to = actualRelationship.remote; // should match cur.target
		join.from = actualRelationship.local;
		join.relationship = actualRelationship;
	} else if (join.from) {
		const relationship = composite.nexus.mapper.getRelationship(
			fromModel,
			toModel,
			join.from
		);

		if (!relationship) {
			throw create(
				`composite ${composite.name}: can not connect ${fromModel} to ${toModel}`,
				{
					code: 'BMOOR_CRUD_COMPOSITE_NO_FROM',
					context: {
						fromModel,
						toModel,
						join
					}
				}
			);
		}

		join.to = relationship.remote; // should match cur.target
		join.from = relationship.local;
		join.relationship = relationship;
	} else {
		const relationship = composite.nexus.mapper.getRelationship(
			fromModel,
			toModel
		);

		if (!relationship) {
			throw create(
				`composite ${composite.name}: can not connect ${fromModel} to ${toModel}`,
				{
					code: 'BMOOR_CRUD_COMPOSITE_NO_RELATIONSHIP',
					context: {
						fromModel,
						toModel,
						join
					}
				}
			);
		}

		join.to = relationship.remote; // should match cur.target
		join.from = relationship.local;
		join.relationship = relationship;
	}
}

class Composite extends Structure {
	constructor(name, nexus) {
		super(name, nexus);

		this.calculateDynamics = (datum) => datum;
		this.encodeResults = (datum) => datum;
	}

	async linkFields() {
		return Promise.all(
			this.instructions.fields.map(async (property) => {
				const accessor = property.action;
				const series = accessor.series;

				if (!accessor.field) {
					throw create(
						`composite ${this.name}: need a field ${property.statement}`,
						{
							code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_INVALID',
							context: {
								accessor
							}
						}
					);
				} else if (property.isArray) {
					throw create(
						`composite ${this.name}: dynamic array defined ${property.statement}`,
						{
							code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_MAGIC',
							context: {
								accessor,
								property
							}
						}
					);
				}

				// this needs to be get variables, and get variables guarentees where to find
				// the variable
				await this.addField(property.path, {
					model: accessor.model,
					extends: accessor.field,
					series
				});
			})
		);
	}

	async linkSubs() {
		const joinParams = this.incomingSettings.joinParams || {};

		return Promise.all(
			this.instructions.subs.map(async (sub, i) => {
				// I'm going to make sure all previous files are imported
				const include = sub.action;

				if (include.field) {
					throw create(
						`composite ${this.name}: no field from ${sub.statement}`,
						{
							code: 'BMOOR_CRUD_COMPOSITE_SCHEMA_ACCESS',
							context: {
								sub
							}
						}
					);
				}

				// I'm making this only work with one link right now, but
				// multiple could work
				const mountPath = this.instructions.getMount(include.series);
				const tail = mountPath.shift();
				const mountPoint = mountPath[0];

				// this is calculated when linking, which runs before this
				// method is called
				const join = tail.join[mountPoint.series];

				let field = (await this.nexus.loadModel(tail.model)).getField(
					join.from
				);
				if (!this.hasField(field)) {
					const ref = `sub_${i}`;

					field = await this.addField(ref, {
						model: tail.model,
						series: tail.series,
						extends: join.from,
						synthetic: true
					});

					join.clear = ref;
				}

				const info = this.instructions.getSeries(include.series);
				const composite = await this.nexus.loadComposite(info.composite);

				// TODO: this should get a series name right?
				let joinPath = '';
				mountPath.reduce((prev, cur) => {
					const innerJoin = prev.join[cur.series];

					joinPath +=
						'$' + prev.model + '.' + innerJoin.from + '>.' + innerJoin.to;

					return cur;
				});

				if (joinPath) {
					joinPath += '$' + composite.baseModel.name;
				}

				const paramModel = mountPoint.model || composite.baseModel.name;

				return {
					info: sub,
					mounts: [
						{
							path: field.path,
							clear: !!join.clear,
							param: '$' + paramModel + '.' + join.to,
							joinPath
						}
					],
					composite,
					params: joinParams[sub.action.series] || {}
				};
			})
		);
	}

	// connects all the models and all the fields
	async link() {
		if (this.references) {
			return;
		}

		if (this._isLinking) {
			return this._isLinking;
		}

		this.base = await this.nexus.getCrud(this.incomingSettings.base);
		this.baseModel = this.base.structure;

		// doing this is protect from collisions if multiple links are called
		// in parallel of the same type
		const linker = async () => {
			const settings = this.incomingSettings;

			let ext = settings.extends;
			if (ext) {
				const parent = await this.nexus.loadComposite(ext);

				await parent.link();

				this.instructions.extend(parent.instructions);

				if (!settings.getChangeType) {
					settings.getChangeType = parent.incomingSettings.getChangeType;
				}

				if (!settings.onChange) {
					settings.onChange = parent.incomingSettings.onChange;
				}

				this.calculateDynamics = parent.calculateDynamics;

				this.encodeResults = parent.encodeResults;
			}

			if (this.instructions.fields.length === 0) {
				throw create(`composite ${this.name}: no properties found`, {
					code: 'BMOOR_CRUD_COMPOSITE_NO_PROPERTIES',
					context: settings
				});
			}

			// let's go through all the properties and figure out what is a field and
			// a foreign reference.  It's ok to precalculate the joins even if
			// the fields won't be in the actual query, because I use the joins
			// other places if needed
			await Promise.all(
				this.instructions.getAllSeries().map(async (series) => {
					const info = this.instructions.getSeries(series);

					if (!info.join) {
						// subs don't join, so skip them
						return;
					}

					return Promise.all(
						Object.keys(info.join).map(async (nextSeries) => {
							const join = info.join[nextSeries];
							const nextInfo = this.instructions.getSeries(nextSeries);

							if (nextInfo.model) {
								await computeJoin(this, join, info.model, nextInfo.model);
							} else {
								const composite = await this.nexus.loadComposite(
									nextInfo.composite
								);

								if (info.model === composite.baseModel.name) {
									const model = await composite.nexus.loadModel(info.model);

									const key = model.getKeyField();

									join.to = key;
									join.from = key;
								} else {
									await computeJoin(
										this,
										join,
										info.model,
										composite.baseModel.name
									);
								}
							}
						})
					);
				})
			);

			await this.linkFields();

			this.subs = await this.linkSubs();
		};

		this._isLinking = linker();

		return this._isLinking;
	}

	async build() {
		try {
			if (this.incomingSettings.optimize) {
				await this.flatten();
			}

			await this.link();

			await super.build();
		} catch (ex) {
			addTrace(ex, {
				code: 'BMOOR_CRUD_COMPOSITE_BUILD',
				context: {
					composite: this.name
				}
			});

			throw ex;
		}
	}
	/***
	 * {
	 *  nexus,
	 *  fields,
	 *  extends
	 * }
	 ***/
	async configure(settings) {
		await super.configure(settings);

		if (!settings.base) {
			throw create(`composite ${this.name}: no base defined`, {
				code: 'BMOOR_CRUD_COMPOSITE_CONFIGURE_BASE',
				context: settings
			});
		}

		if (!settings.joins) {
			throw create(`composite ${this.name}: no joins defined`, {
				code: 'BMOOR_CRUD_COMPOSITE_CONFIGURE_JOINS',
				context: settings
			});
		}

		if (!settings.fields) {
			throw create(`composite ${this.name}: no fields defined`, {
				code: 'BMOOR_CRUD_COMPOSITE_CONFIGURE_FIELDS',
				context: settings
			});
		}

		this.instructions = new Instructions(
			settings.base,
			settings.joins,
			settings.fields,
			settings.params
		);

		const rtn = await this.build();

		this.calculateDynamics = buildCalculations(
			settings.dynamics,
			this.calculateDynamics
		);

		if (settings.encode) {
			const encode = settings.encode;

			if (this.encodeResults) {
				const old = this.encodeResults;

				this.encodeResults = async function (schema, ctx) {
					return encode(await old(schema, ctx), ctx);
				};
			} else {
				this.encodeResults = encode;
			}
		}

		this.preparedQuery = await this.prepareBaseQuery();

		return rtn;
	}

	async flatten() {
		let pos = 0;

		while (pos < this.instructions.subs.length) {
			const sub = this.instructions.subs[pos];

			if (sub.isArray) {
				pos++;
			} else {
				// the series is removed, so no need to iterate
				const series = this.instructions.getSeries(sub.action.series);
				const composite = await this.nexus.loadComposite(series.composite);

				this.instructions.inline(sub.action.series, composite.instructions);
			}
		}
	}

	// TODO: probably should remove at this point
	hasStructure(structureName) {
		let found = null;

		for (let i = 0, c = this.fields.length; i < c && !found; i++) {
			const field = this.fields[i];

			if (field.structure.name === structureName) {
				found = field;
			}
		}

		return found;
	}

	assignField(field, settings) {
		// I don't think I need this anymore?
		// this.references[field.reference] = field;

		return super.assignField(field, settings);
	}

	defineField(path, settings = {}) {
		if (!settings.extends) {
			throw create(`composite ${this.name}: failed on ${path}`, {
				code: 'BMOOR_CRUD_COMPOSITE_SERIES',
				context: settings
			});
		}

		// let's overload the other field's settings
		const fieldSettings = {
			series: settings.series,
			reference: settings.reference,
			synthetic: settings.synthetic
		};

		// this is basically: new Field(path, this, settings);
		return settings.extends.extend(path, fieldSettings);
	}

	async addField(path, settings = {}) {
		if (!settings.series) {
			throw create(`Unable to link path without target series`, {
				code: 'BMOOR_CRUD_COMPOSITE_SERIES',
				context: settings
			});
		}

		const modelName = settings.model;
		const reference = settings.extends;

		const model = await this.nexus.loadModel(modelName);
		const field = model.getField(reference);

		if (!field) {
			throw create(`Complex, unknown field: ${modelName}.${reference}`, {
				code: 'BMOOR_CRUD_COMPOSITE_UNKNOWN',
				context: {
					path,
					modelName,
					reference
				}
			});
		}

		if (this.connector) {
			if (this.connector !== model.connector) {
				throw create(
					`Mixing connector types: ${this.connector} => ${modelName}.${model.connector}`,
					{
						code: 'BMOOR_CRUD_COMPOSITE_CONNECTOR',
						context: {
							current: this.connector,
							model: modelName,
							newConnector: model.connector
						}
					}
				);
			}
		} else {
			this.connector = model.connector;
		}

		settings.extends = field;

		return super.addField(path, settings);
	}

	getBaseQuery() {
		return new QueryStatement(this.instructions.model);
	}

	async prepareBaseQuery(ctx) {
		const query = await super.prepareBaseQuery(ctx);

		this.instructions.forEach((series, seriesInfo) => {
			if (!seriesInfo.isNeeded) {
				return;
			}

			query.setModel(series, this.nexus.getModel(seriesInfo.model));

			const joinsTo = seriesInfo.join;

			if (joinsTo) {
				const todo = Object.keys(joinsTo);
				if (todo.length) {
					query.addJoins(
						series,
						todo
							.filter(
								(nextSeries) => this.instructions.getSeries(nextSeries).isNeeded
							)
							.map((nextSeries) => {
								const join = joinsTo[nextSeries];

								const subSeries = this.instructions.getSeries(nextSeries);

								return new QueryJoin(
									nextSeries,
									[{from: join.from, to: join.to}],
									subSeries.optional
								);
							})
					);
				}
			}
		});

		return query;
	}

	// produces representation for interface layer
	async getQuery(settings = {}, ctx = {}) {
		const query = this.preparedQuery.clone();

		return super.extendQuery(
			query,
			{
				joins: settings.joins,
				params: {...settings.params, ...this.instructions.params},
				sort: settings.sort,
				position: settings.position
			},
			ctx
		);
	}

	// this.settings.subs.reference.composite
	async getKeyQueryBySeries(compositeName, key /*, ctx*/) {
		await this.link();

		const baseModel = this.baseModel.name;
		const query = new QueryStatement(baseModel);

		// get everything from the composite to the outer layer
		const linking = this.instructions
			.getTrace(compositeName)
			.map(async ({series, incoming, optional}) => {
				const modelName = this.instructions.getSeries(series).model;

				if (modelName) {
					const model = await this.nexus.loadModel(modelName);

					query.setModel(series, model);
				} else {
					// I can do this because there should be only one sub in
					// the chain

					// add the composite's model and request the key
					const sub = await this.nexus.loadComposite(compositeName);
					const model = await this.nexus.loadModel(sub.baseModel.name);

					query.setModel(compositeName, model);

					query.addParams(compositeName, [
						buildParam(model.getKeyField(), key, StatementParam)
					]);
				}

				if (incoming) {
					// Do I care where I am connecting to?
					query.addJoins(
						series,
						incoming.map((joiner) => {
							const join = this.instructions.getJoin(joiner, series);

							return new QueryJoin(
								joiner,
								[{from: join.to, to: join.from}],
								optional
							);
						})
					);
				}
			});

		await Promise.all(linking);

		// return back the keys of the base model
		query.addFields(baseModel, [
			new StatementField(this.baseModel.getKeyField(), 'key')
		]);

		return query;
	}

	async getKeyQueryByModel(byModelName, key /*, ctx={}*/) {
		await this.link();

		const baseModel = this.baseModel.name;
		const query = new QueryStatement(baseModel);

		// get everything from the composite to the outer layer
		const linking = this.instructions
			.getTrace(...this.instructions.getSeriesByModel(byModelName))
			.map(async ({series, incoming, optional}) => {
				const modelName = this.instructions.getSeries(series).model;
				const model = await this.nexus.loadModel(modelName);

				query.setModel(series, model);

				if (byModelName === modelName) {
					query.addParams(series, [
						buildParam(model.getKeyField(), key, StatementParam)
					]);
				}

				if (incoming) {
					// Do I care where I am connecting to?
					query.addJoins(
						series,
						incoming.map((joiner) => {
							const join = this.instructions.getJoin(joiner, series);

							return new QueryJoin(
								joiner,
								[{from: join.to, to: join.from}],
								optional
							);
						})
					);
				}
			});

		await Promise.all(linking);

		// return back the keys of the base model
		query.addFields(baseModel, [
			new StatementField(this.baseModel.getKeyField(), 'key')
		]);

		return query;
	}

	async getInflater(ctx) {
		await this.link();

		const inflater = this.actions.inflate;

		return function complexInflate(datum) {
			return inflater(datum, ctx);
		};
	}

	async getDeflater(ctx) {
		await this.link();

		const deflater = this.actions.deflate;

		return function complexDeflate(datum) {
			return deflater(datum, ctx);
		};
	}
}

module.exports = {
	Composite
};
