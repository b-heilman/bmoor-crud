const {Config} = require('bmoor/src/lib/config.js');
const {apply, create} = require('bmoor/src/lib/error.js');

const {Field} = require('./field.js');
const {Path} = require('../graph/path.js');
const {StructureActions} = require('./structure/actions.js');
const {StatementField} = require('./statement/field.js');
const {StatementVariable} = require('./statement/variable.js');
const {buildExpression} = require('./statement/expression/compiler.js');
const {QueryJoin} = require('./query/join.js');
const {QuerySort} = require('./query/sort.js');
const {QueryPosition} = require('./query/position.js');

const major = Symbol('major');
const minor = Symbol('minor');
const none = Symbol('none');

const createMode = Symbol('create');
const updateMode = Symbol('update');

const config = new Config({
	changeTypes: {
		major,
		minor,
		none
	},
	changeRankings: {
		[major]: 2,
		[minor]: 1,
		[none]: 0
	},
	writeModes: {
		create: createMode,
		update: updateMode
	}
});

const usages = new Config({
	json: {
		onInflate: function (datum, setter, getter) {
			const value = getter(datum);

			if (value) {
				setter(datum, JSON.parse(value));
			}
		},
		onDeflate: function (datum, setter, getter) {
			const value = getter(datum);

			if (value) {
				setter(datum, JSON.stringify(value));
			}
		}
	},
	monitor: {
		onCreate: function (datum, setter, getter, cfg) {
			const target = cfg.getTarget(datum);

			if (target !== undefined) {
				setter(datum, Date.now());
			}
		},
		onUpdate: function (datum, setter, getter, cfg) {
			const target = cfg.getTarget(datum);

			if (target !== undefined) {
				setter(datum, Date.now());
			}
		}
	}
});

/**
tableLink: {
	name:
	field:	
}

fieldDef: {
	-- crud operations
	create
	read
	update

	-- 
	key: // is a primary key
	index: // can be used as a unique index
	query: // fields allowed to be queries on

	-- structure
	link: <tableLink> // if a foreign key
}

fields: {
	[externalPath]: <fieldDef>
}

structure: {
	name: '',
	type: '',
	fields: <fields>
}
**/

function buildSorts(query, sorts) {
	sorts.split(',').map((option) => {
		option = option.trimStart();

		let ascending = true;
		let char = option[0];

		if (char === '-') {
			ascending = false;
			option = option.substr(1);
		} else if (char === '+') {
			option = option.substr(1);
		}

		let base = query.baseSeries.series;
		if (option[0] === '$') {
			const pos = option.indexOf('.');

			base = option.substr(1, pos - 1);
			option = option.substr(pos + 1);
		} else if (option[0] === '.') {
			option = option.substr(1);
		}

		query.addSort(new QuerySort(base, option, ascending));
	});
}

function buildValidator(old, field, validation) {
	function validate(datum, mode = updateMode) {
		const rtn = [];
		const value = field.externalGetter(datum);

		if (validation.required) {
			if (!value && (mode === createMode || value !== undefined)) {
				rtn.push({
					path: field.path,
					message: 'can not be empty'
				});
			}
		}

		return rtn;
	}

	if (old) {
		return function (datum, mode) {
			return old(datum, mode).concat(validate(datum, mode));
		};
	} else {
		return validate;
	}
}

function compareChanges(was, now) {
	let rtn = was;

	if (now) {
		if (!was) {
			rtn = now;
		} else {
			const rankings = config.get('changeRankings');

			if (rankings[now] > rankings[was]) {
				rtn = now;
			}
		}
	}

	return rtn;
}

function buildChangeCompare(old, field, type) {
	if (old) {
		return function (delta) {
			return compareChanges(
				old(delta),
				field.externalGetter(delta) === undefined ? null : type
			);
		};
	} else {
		return function (delta) {
			return field.externalGetter(delta) === undefined
				? config.get('changeTypes.none')
				: type;
		};
	}
}

function buildSettings(properties, field) {
	const settings = field.incomingSettings;

	if (settings.validation) {
		properties.validation = buildValidator(
			properties.validation,
			field,
			settings.validation
		);
	}

	if (settings.updateType) {
		properties.calculateChangeType = buildChangeCompare(
			properties.calculateChangeType,
			field,
			settings.updateType
		);
	}

	return properties;
}

async function addAccessorsToQuery(accessors, query, nexus) {
	return accessors.reduce(async (prev, accessor) => {
		let relationship = null;
		let from = null;
		let to = null;

		prev = await prev;

		let pSeries = prev.series;
		let aSeries = accessor.series;

		const model = nexus.getModel(accessor.model);
		query.setModel(aSeries, model);

		// this ensures everything is linked accordingly
		// await addStuff(this, prev, subAccessor);
		if (accessor.target) {
			relationship = nexus.mapper.getRelationship(
				accessor.model,
				prev.model,
				accessor.target
			);
			from = aSeries;
			to = pSeries;
		} else {
			relationship = nexus.mapper.getRelationship(
				prev.model,
				accessor.model,
				prev.field
			);
			from = pSeries;
			to = aSeries;
		}

		if (!relationship) {
			throw create(
				`accessor relationship failed: ${prev.model} -> ${accessor.model}`,
				{
					code: 'BMOOR_CRUD_STRUCTURE_RELATIONSHIP',
					context: {
						accessorModel: accessor.model,
						accessorField: accessor.target,
						prevModel: prev.model,
						prevField: prev.field
					}
				}
			);
		}

		query.addJoins(from, [
			new QueryJoin(
				to,
				[
					{
						from: relationship.local,
						to: relationship.remote
					}
				],
				accessor.optional
			)
		]);

		return accessor;
	});
}

class Structure {
	constructor(name, nexus) {
		this.name = name;
		this.nexus = nexus;
	}

	async configure(settings) {
		this.incomingSettings = settings;

		this.fields = [];
		this.index = {};
	}

	// optimization phase
	async build() {
		this.actions = new StructureActions(this.fields);

		// TODO: StructureSettings
		this.settings = this.fields.reduce(buildSettings, {
			validation: null,
			calculateChangeType: null
		});
	}

	assignField(field) {
		const found = this.index[field.path];
		if (found) {
			throw create(`Path collision`, {
				code: 'BMOOR_CRUD_STRUCTURE_COLLISION',
				context: {
					name: this.name,
					existing: this.index[field.path],
					incoming: field
				}
			});
		}

		this.index[field.path] = field;
		this.fields.push(field);

		return field;
	}

	defineField(path, settings) {
		if (settings.usage) {
			// this allows types to define onCreate, onRead, onUpdate, onDelete
			Object.assign(settings, usages.get(settings.usage) || {});
		}

		return new Field(path, this, settings);
	}

	createField(path, settings) {
		return this.assignField(this.defineField(path, settings), settings);
	}

	async addField(path, settings) {
		return this.createField(path, settings);
	}

	getField(path) {
		return this.index[path];
	}

	getFields() {
		return this.fields;
	}

	hasField(searchField) {
		let found = false;

		for (let i = 0, c = this.fields.length; i < c && !found; i++) {
			const field = this.fields[i];

			found = field === searchField || field.original === searchField;
		}

		return found;
	}

	async testField(field, type, ctx){
		// if I need to in the future, I can load the permission here then run the test
		const op = field.incomingSettings[type];

		if (op) {
			if (typeof op === 'string') {
				try {
					return ctx.hasPermission(op);
				} catch (ex) {
					apply(ex, {
						code: 'BMOOR_CRUD_SCHEMA_TEST_FIELD',
						context: {
							type,
							external: field.path,
							structure: field.structure.name
						}
					});

					throw ex;
				}
			} else {
				return true;
			}
		}

		return false;
	}

	async testFields(type, ctx) {
		return this.fields.reduce(async (prom, field) => {
			const [test, agg] = await Promise.all([
				this.testField(field, type, ctx),
				prom
			]);

			if (test) {
				agg.push(field);
			}

			return agg;
		}, []);
	}

	getFieldSeries() {
		const rtn = new Set();

		this.fields.forEach((field) => {
			rtn.add(field.series);
		});

		return rtn;
	}

	deflate(datum, ctx) {
		if (!this.actions) {
			this.build();
		}

		return this.actions.deflate(datum, ctx);
	}

	inflate(datum, ctx) {
		if (!this.actions) {
			this.build();
		}

		return this.actions.inflate(datum, ctx);
	}

	// generates the base query object for the class, stubed under structure
	getBaseQuery() {
		throw new Error('must be extended');
	}

	// used to extend all statements (query or executable).  These are contextless
	// properties
	async extendBaseStatement(statement) {
		const filters = this.incomingSettings.filters;
		if (filters) {
			statement.addFilterExpression(buildExpression(filters));
		}
	}

	// create a base statement and extend it
	async prepareBaseQuery() {
		const query = this.getBaseQuery();

		await this.extendBaseStatement(query);

		const sorts = this.incomingSettings.sort;
		if (sorts) {
			buildSorts(query, sorts);
		}

		return query;
	}

	// Add content to a statement based on the given context.  This will be run
	// each invocation, unlike the prepare which is univeral across all contexts
	async extendStatement(statement, settings, ctx) {
		// TODO: the level above should translate the fields
		/**if (){
			// this will allow you to select a subset of the structure's fields and remap them
			const imploded = implode(settings.fields);
			await Object.keys(imploded).reduce(
				async (agg, mount) =>{
					const info = translateField(mount, imploded[mount]);

					const field = this.getField(info.action.field);

					if (field.series !== accessor.series) {
						throw create(
							`series mismatch: ${field.series} vs ${accessor.series}`,
							{
								code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_INVALID',
								context: {
									accessor
								}
							}
						);
					}

					if (this.testField(field, 'read', ctx)){
						statement.addFields(field.series, [
							new StatementField(field.storagePath, mount)
						]);
					}

					return agg;
				}, []
			);
		} else {
		**/
		// this is in extended because some fields are based on permission.
		// I could preload some and do the rest, but for now this is how
		// it will work
		(settings.fields || await this.testFields('read', ctx)).forEach((field) => {
			statement.addFields(field.series, [
				new StatementField(field.storagePath, field.reference || null)
			])
		});

		// I'm doing this so people have a way around validation if they deem in neccisary.  I'm sure this
		// will result in someone getting hacked, but I want to trust the devs using this

		// supports complex query structures
		const query = settings.query;
		if (query) {
			let isValid = true;
			const exp = buildExpression(query);

			if (settings.validate) {
				isValid = exp.validate((series, path) => {
					if (statement.hasSeries(series)) {
						const model = statement.getSeries(series).model;

						const field = model.getField(path);

						if (!field) {
							throw new Error(`unknown field: ${series}.${path}`);
						} else if (!field.incomingSettings.query) {
							throw new Error(`unqueriable field: ${series}.${path}`);
						}
					} else {
						throw new Error(`unknown series: ${series}`);
					}
				});
			}

			if (isValid) {
				statement.addParamExpression(exp);
			}
		}

		// params are designed for simple joins or references
		/** structure
		 * {
		 * 	[inside series].[inside property]: [inside value]
		 * }
		 **/
		//since this is no longer exposed externally, I can change the structure
		const params = settings.params;
		if (params) {
			Object.keys(params).map((field) => {
				let path = null;
				let {series} = statement.baseSeries;

				const param = params[field];

				if (field[0] === '$') {
					const pos = field.indexOf('.');

					series = field.substr(1, pos - 1);
					path = field.substr(pos + 1);
				} else {
					if (field[0] === '.') {
						field = field.substr(1);
					}

					path = field;
				}

				statement.addParam(new StatementVariable(series, path, param, '='));
			});
		}
	}

	// assigns query specific fields
	async extendQuery(query, settings, ctx) {
		// this is the query property.  It allows you to 'join in' from the outside
		/** structure
		 * {
		 * 	[[outside property][outside series] > [inside series]]: [outside value]
		 * }
		 **/
		if (settings.joins) {
			await settings.joins.reduce(async (prom, path) => {
				await prom;

				path = path.trimStart();

				if (path[0] === '.') {
					/**
					 * I want to allow .property notion here, but I don't want to break
					 * .aField$series so I have to check
					 **/
					const seriesPos = path.indexOf('$');

					if (seriesPos === -1) {
						path = '$' + query.base + path;
					}
				}

				const access = new Path(path).access;

				// links in are [model].value > [existingModel]
				const mountAccessor = access[access.length - 1];
				const mountSeries = mountAccessor.series;

				// this verified the mount point is inside the model
				if (!query.hasSeries(mountSeries)) {
					throw new Error(`unable to mount: ${mountSeries} from ${path}`);
				}

				// this defined the series' model
				await addAccessorsToQuery(access, query, this.nexus);

				const rootAccessor = access[0];

				const model = this.nexus.getModel(rootAccessor.model); // has to be defined by now
				query.setModel(rootAccessor.series, model);
			}, Promise.resolve(true));
		}

		await this.extendStatement(query, settings, ctx);

		if (settings.sort) {
			buildSorts(query, settings.sort);
		}

		if (settings.position && settings.position.limit) {
			query.setPosition(new QueryPosition(0, settings.position.limit));
		}

		return query;
	}

	getChangeType(delta) {
		if (this.settings.calculateChangeType) {
			return this.settings.calculateChangeType(delta);
		} else {
			return none;
		}
	}

	validate(delta, mode) {
		if (this.settings.validation) {
			return this.settings.validation(delta, mode);
		} else {
			return [];
		}
	}

	toJSON() {
		return {
			$schema: 'bmoor-crud:structure',
			name: this.name,
			fields: this.fields.map((field) => field.toJSON())
		};
	}
}

module.exports = {
	usages,
	config,
	compareChanges,
	addAccessorsToQuery,
	Structure
};
