
const {implode} = require('bmoor/src/object.js');
const {create} = require('bmoor/src/lib/error.js');
const {get, set, del} =  require('bmoor/src/core.js');

const {Transformer} = require('bmoor-schema/src/Transformer.js');

const {compareChanges} = require('../model.js');

const {View} = require('../view.js');
const {Complex} = require('../complex.js');
const {Path} = require('../graph/path.js');

const normalized = require('./normalized.js');

function fieldParser(field){
	const access = (new Path(field)).access;
	const loader = access[access.length-1].loader;

	return {
		loader,
		access
	};
}

function mountParser(mount){
	const isArray = mount.indexOf('[0]') !== -1;

	return {
		isArray,
		path: mount.substring(0, isArray ? mount.length-3 : mount.length)
	};
}

function knownSeries(aliases, accessor){
	return !!aliases[accessor.root];
}

function getSeries(aliases, names, accessor){
	if (!knownSeries(aliases, accessor)){
		let name = accessor.series || accessor.model;
		let count = names[name];

		if (!count){
			// first one gets the real name
			names[name] = 1;
		} else {
			// if you didn't define a series for it, you must not care
			// to link into it
			name += '_'+count;
			names[name] = count + 1;
		}

		aliases[accessor.root] = name;
	}

	return aliases[accessor.root];
}

function linkSeries(aliases, complex, names, prev, accessor){
	let series = aliases[accessor.root];

	if (!knownSeries(aliases, accessor)){
		series = getSeries(aliases, names, accessor);
		aliases[accessor.root] = series;

		if (prev){
			complex.setConnection(prev.model, accessor.model, prev.field, {
				baseSeries: prev.series,
				targetSeries: series
			});
		}
	}

	accessor.series = series;

	return series;
}

class Composite extends View {
	constructor(nexus, connector, settings){
		const complex = new Complex(nexus);

		super(complex, connector);

		this.settings = settings;
		// validate key
		// validate base

		const subs = [];
		const aliases = {};
		const names = {};

		let imploded = implode(settings.schema);

		this.subs = subs;
		this.ready = Promise.resolve()
		.then(async () => {
			// extend imploded if extends is defined
			if (settings.extends){
				const parent = await nexus.loadComposite(settings.extends);
				const parentImploded = implode(parent.settings.schema);

				imploded = Object.assign(
					Object.keys(parentImploded).reduce(
						(agg, dex) => {
							agg[dex] = '$'+settings.base+'>'+parentImploded[dex];

							return agg;
						}, 
						{}
					),
					imploded
				);

				if (!settings.getChangeType){
					settings.getChangeType = parent.settings.getChangeType;
				}

				if (!settings.onChange){
					settings.onChange = parent.settings.onChange;
				}
			}
		}).then(() => Promise.all(
			// load all the fields
			Object.keys(imploded)
			.map(async (path) => {
				//[type]tableName.properties

				const field = imploded[path];

				const line = fieldParser(field);
				const mount = mountParser(path);

				if (line.loader === 'access'){
					let series = null;

					line.access.reduce(
						(prev, curr) => {
							series = linkSeries(aliases, this.schema, names, prev, curr);

							return curr;
						},
						null
					);
					const accessor = line.access.pop();

					if (!accessor.field){
						throw create('model references need a field: '+path, {
							code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_INVALID'
						});
					} else if (mount.isArray){
						throw create('dynamic subschemas not yet supported: '+path, {
							code: 'BMOOR_CRUD_COMPOSITE_PROPERTY_MAGIC'
						});
					}

					return complex.addField(path, accessor.model, accessor.field, {
						series
					});
				} else if (line.loader === 'include'){
					// I'm going to make sure all previous files are imported
					const include = line.access.pop();

					if (include.field){
						throw create('can not pull fields from composites: '+path, {
							code: 'BMOOR_CRUD_COMPOSITE_SCHEMA_ACCESS'
						});
					}

					// I don't like this, it limits me to by id, but I'll fix it down
					//   the road.
					subs.push({
						field,
						mount,
						access: line.access,
						query: {},
						composite: await nexus.loadComposite(include.model), //#<sub model>
						clear: []
					});
				} else {
					throw create('unknown line type: '+line.type, {
						code: 'BMOOR_CRUD_COMPOSITE_UNKNOWN'
					});
				}
			})
		)).then(() => Promise.all(
			// here's what I need to do.  Go through the mount path, figure out
			// the last model / field in the path, and mark that.  The rest goes
			// back into the query
			subs.map(async (sub, i) => {
				const access = sub.access.slice(0);

				// remove all accessors that are part the base schema, the
				// last one becomes the root

				access.reduce(
					(prev, cur) => {
						if (cur.target){
							// the current pointer knows the target property, it gets priority
							const relationship = this.schema.nexus.mapper.getRelationship(
								cur.model, prev.model, cur.target
							);

							cur.target = relationship.local; // should match cur.target
							prev.field = relationship.remote;
							cur.relationship = relationship;
						} else {
							const relationship = this.schema.nexus.mapper.getRelationship(
								prev.model, cur.model, prev.field
							);

							cur.target = relationship.remote;
							prev.field = relationship.local;
							cur.relationship = relationship;
						}

						return cur;
					}
				);

				let root = null;
				let prev = null;
				
				while(access.length && this.schema.hasModel(access[0].model)){
					prev = root;
					root = access.shift();
				}

				//let's verify the link is ok...
				const tail = access.length ? access[access.length-1] : root;
				const relationship = this.schema.nexus.mapper.getRelationship(
					tail.model, sub.composite.settings.base
				);

				let key = null;
				if (relationship){
					key = relationship.remote;
					tail.field = relationship.local;
				} else {
					throw new Error(tail.model+
						' can not connect to '+sub.composite.settings.base+
						': '+sub.field
					);
				}

				// it can be assumed that everything at this point is already
				// connected
				let field = this.schema.findField(root.model, root.field);

				if (!field){
					const series = getSeries(aliases, names, root);
					const alias = `sub_${i}`;//race condition: `sub_${this.schema.fields.length}`;
					
					sub.alias = alias;

					field = await complex.addField(alias, root.model, root.field, {
						series
					});

					sub.clear.push(alias);
				}
				
				access.push({
					loader: 'access',
					model: sub.composite.settings.base,
					target: key,
					relationship
				});

				sub.root = root;
				sub.access = access;

				sub.query[(new Path(access)).path] = field.external;
			})
		)).then(() => this);
	}

	async read(id, ctx){
		await this.ready;

		const query ={
			['$'+this.settings.base+'.'+this.settings.key]: id
		};

		return (
			await this.query(query, ctx)
		)[0];
	}

	async query(search, ctx){
		await this.ready;

		// prepare the query
		if (this._beforeQuery){
			await this._beforeQuery(search, ctx);
		}

		const query = await this.schema.getQuery(search, {}, ctx);
		const res = await super.read(query, ctx);
		
		//TODO: figure out how to cache this, because it's not efficient rebuilding every time...
		return Promise.all(res.map(
			async (datum) => {
				// Loop through each result, and process the sub queries for each
				await Promise.all(this.subs.map(
					async (sub) => {
						const query = Object.keys(sub.query)
						.reduce(
							(agg, key) => {
								agg[key] = get(datum, sub.query[key]);

								return agg;
							}, 
							{}
						);

						return sub.composite.query(query)
						.then(res => {
							set(
								datum,
								sub.mount.path,
								sub.mount.isArray ? res : res[0]
							);
						});
					}
				));

				// delete after incase there's a collision between subs
				this.subs.map(
					sub => {
						sub.clear.forEach(path => del(datum, path));
					}
				);

				return datum;
			}
		));
	}

	async normalize(datum, instructions = null){
		await this.ready;

		if (!instructions){
			instructions = new normalized.Schema(this.schema.nexus);
		}

		const transitions = this.schema.fields
		.reduce(
			(agg, info) => {
				const field = this.schema.aliases[info.alias];
				const series = info.series;

				let trans = agg[series];
				if (!trans){
					trans = {
						model: field.model.name,
						mappings: []
					};
					agg[series] = trans;
				}

				trans.mappings.push({
					from: info.external,
					to: field.external
				});

				return agg;
			},
			{}
		);

		const doc = {};
		const references = {};

		let changeType = null;

		const cbs = await Promise.all(
			Object.keys(transitions)
			.map(async (series) => {
				const trans = transitions[series];

				const transformer = new Transformer(trans.mappings);

				const service = await this.schema.nexus.loadService(trans.model);

				// I need to generate references for the second loop
				const ref = new normalized.DatumRef(series);
				references[series] = ref;

				const content = await transformer.go(datum, {
					$ref: ref
				});
				
				const key = service.schema.getKey(content);
				content.$type = !key ? 'create' : 'update';

				let model = doc[trans.model];
				if (!model){
					model = [];
					doc[trans.model] = model;
				}

				model.push(content);

				// generate a series of call back methods to be called once
				// everything is resolved
				return () => {
					const connections = this.schema.connections[series];

					if (connections){
						connections.forEach(connection => {
							set(content, connection.local, references[connection.name]);
						});	
					}
				};
			})
		);

		await cbs.map(cb => cb());

		const series = instructions.import(doc);
		
		// I don't like this, but for now I'm gonna put hooks in that allow.
		// eventually I want this to be a function of getChangeType from model
		if (this.settings.getChangeType){
			changeType = await this.settings.getChangeType(series);
		}

		await Promise.all(this.subs.map(
			sub => {
				let content = get(datum, sub.mount.path);
				
				if (!sub.mount.isArray){
					content = [content];
				}

				return Promise.all(content.map(
					async (subDatum) => {
						const {series: subSeries, changeType: subChange} = await sub.composite.normalize(subDatum, instructions);

						changeType = compareChanges(changeType, subChange);

						let found = false;
						const access = sub.access.filter(d => {
							if (!subSeries.has(d.model)){
								return true;
							} else if (!found){
								found = true;

								return true;
							} else {
								return false;
							}
						});

						access.reduce(
							(prev, cur) => {
								const direction = cur.relationship.metadata.direction;

								// map one way or another, figure out direction
								let left = null;
								let right = null;
								let field = null;

								if (direction === 'incoming'){
									left = cur.model;
									right = prev.model;
									field = cur.relationship.remote;
								} else { // outgoing
									left = prev.model;
									right = cur.model;
									field = cur.relationship.local;
								}

								// what if one of them doesn't exist?
								const target = subSeries.get(left);
								let datum = null;

								if (target){
									datum = target[0];
								} else {
									datum = subSeries.create(
										left,
										new normalized.DatumRef(left),
										'create', 
										{}
									);
								}

								const source = prev.series.get(right);
								let s = null;

								if (source){
									s = source[0];
								} else {
									s = subSeries.create(
										right, 
										new normalized.DatumRef(right), 
										'create', 
										{}
									);
								}

								datum.setField(field, s.getReference());

								return {
									model: cur.model,
									series: subSeries
								};
							}, 
							{
								model: sub.root.model,
								series
							}
						);
					}
				));
			}
		));

		if (this.settings.onChange && changeType){
			await this.settings.onChange(changeType, series);
		}

		return {
			series,
			instructions,
			changeType
		};
	}

	async push(datum, ctx){
		return normalized.deflate(
			(await this.normalize(datum)).instructions,
			this.schema.nexus,
			ctx
		);
	}

	async update(id, datum, ctx){
		set(datum, this.setting.key, id);

		return this.push(datum, ctx);
	}

	async create(datum, ctx){
		return this.push(datum, ctx);
	}
}

module.exports = {
	Composite
};
