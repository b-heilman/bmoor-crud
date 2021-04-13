
const {get, set, del} =  require('bmoor/src/core.js');

const {Transformer} = require('bmoor-schema/src/Transformer.js');

const {compareChanges} = require('../schema/model.js');

const {View} = require('../services/view.js');
const {Path} = require('../graph/path.js');

const normalized = require('../schema/normalized.js');

/***
 * composite schema
 *-------
 * base: <string> base model to run off 
 * key: <string> index field to use when update is invoked
 * schema: <object> the fields to load
 * getChangeType: <function> processes a series
 * onChange: <function> if a change type is defined, will invoke normalization
 * encoding: <function> transforms a query result to a new format
 ***/
 class Document extends View {

	async link(){
		if (this.subs){
			return;
		}

		await this.structure.link();

		// here's what I need to do.  Go through the mount path, figure out
		// the last model / field in the path, and mark that.  The rest goes
		// back into the query
		const results = this.structure.references
		.map(async (reference, i) => {
			// allow sets of accessors to be added.  This would mean multiple properties are
			// used to join into a sub-composite
			const info = (reference.connections.map(async(access) => {
				let root = null;
				let prev = null;

				access = access.slice(0);

				// remove all accessors that are part the base schema, the
				// last one becomes the root

				access.reduce(
					(prev, cur) => {
						if (cur.target){
							// the current pointer knows the target property, it gets priority
							const relationship = this.structure.nexus.mapper.getRelationship(
								cur.model, prev.model, cur.target
							);

							cur.target = relationship.local; // should match cur.target
							prev.field = relationship.remote;
							cur.relationship = relationship;
						} else {
							const relationship = this.structure.nexus.mapper.getRelationship(
								prev.model, cur.model, prev.field
							);

							cur.target = relationship.remote;
							prev.field = relationship.local;
							cur.relationship = relationship;
						}

						return cur;
					}
				);

				// TODO: this seems like an anti pattern, do I need to change where this
				//   is being computed?
				while(access.length && this.structure.hasStructure(access[0].model)){
					prev = root;
					root = access.shift();
				}

				//let's verify the link is ok...
				const tail = access.length ? access[access.length-1] : root;

				const relationship = this.structure.nexus.mapper.getRelationship(
					tail.model, reference.composite.settings.base
				);

				let key = null;
				if (relationship){
					key = relationship.remote;
					tail.field = relationship.local;
				} else {
					throw new Error(tail.model+
						' can not connect to '+reference.composite.settings.base+
						': '+reference.property.statement
					);
				}

				// it can be assumed that everything at this point is already
				// connected
				const model = await this.structure.nexus.loadModel(root.model);
				let field = model.getField(root.field);
				let clear = null;

				if (!this.structure.hasField(field)){
					const series = '';// getSeries(composite.context, root);
					const alias = `sub_${i}`;//race condition: `sub_${this.schema.fields.length}`;
					
					reference.alias = alias;

					field = await this.structure.addField(alias, {
						model: root.model, 
						extends: root.field,
						series
					});

					clear = alias;
				}
				
				access.push({
					loader: 'access',
					model: reference.composite.settings.base,
					target: key,
					relationship
				});

				return {
					root,
					clear,
					path: (new Path(access)).path,
					accessor: access,
					datumPath: field.path
				};
			}));

			const [doc, joins] = await Promise.all([
				reference.composite.nexus.loadDocument(reference.name),
				Promise.all(info)
			]);
			
			return {
				document: doc,
				reference,
				joins
			};
		});

		this.subs = (await Promise.all(results));
	}

	async query(search, ctx){
		await this.link();

		// prepare the query
		if (this._beforeQuery){
			await this._beforeQuery(search, ctx);
		}

		const query = await this.structure.getQuery(search, {}, ctx);
		const res = await super.read(query, ctx);
		
		//TODO: figure out how to cache this, because it's not efficient rebuilding every time...
		return Promise.all(res.map(
			async (datum) => {
				const clears = [];

				// Loop through each result, and process the sub queries for each
				await Promise.all(this.subs.map(
					async (sub) => {
						const query = sub.joins.reduce(
							(agg, join) => {
								if (join.clear){
									clears.push(join.clear);
								}

								agg[join.path] = get(datum, join.datumPath);

								return agg;
							}, 
							{}
						);

						// call the related document... I could do this up higher?
						const property = sub.reference.property;
						return sub.document.query(query)
						.then(res => {
							set(
								datum,
								property.base,
								property.isArray ? res : res[0]
							);
						});
					}
				));

				// delete after incase there's a collision between subs
				clears.forEach(path => del(datum, path));

				if (this.settings.encoding){
					return this.settings.encoding(datum, ctx);
				} else {
					return datum;
				}
			}
		));
	}

	async read(id, ctx){
		await this.link();

		const query ={
			['$'+this.structure.settings.base+'.'+this.structure.settings.key]: id
		};

		return (
			await this.query(query, ctx)
		)[0];
	}

	async normalize(datum, instructions = null){
		await this.link();

		if (!instructions){
			instructions = new normalized.Schema(this.structure.nexus);
		}

		const transitions = this.structure.fields
		.reduce(
			(agg, field) => {
				const series = field.settings.series;

				let trans = agg[series];
				if (!trans){
					trans = {
						model: field.structure.name,
						mappings: []
					};
					agg[series] = trans;
				}

				trans.mappings.push({
					from: field.path,
					to: field.storagePath
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

				const service = await this.structure.nexus.loadCrud(trans.model);

				// I need to generate references for the second loop
				const ref = new normalized.DatumRef(series);
				references[series] = ref;

				const content = await transformer.go(datum, {
					$ref: ref
				});
				
				const key = service.structure.getKey(content);
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
					const connections = this.structure.connections[series];

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
		if (this.structure.settings.getChangeType){
			changeType = await this.structure.settings.getChangeType(series);
		}

		await Promise.all(this.subs.map(
			sub => {
				let content = get(datum, sub.reference.property.base);
				
				if (!sub.reference.property.isArray){
					content = [content];
				}

				const accessor = sub.joins[0].accessor;
				const root = sub.joins[0].root;

				return Promise.all(content.map(
					async (subDatum) => {
						const {series: subSeries, changeType: subChange} = 
							await sub.document.normalize(subDatum, instructions);

						changeType = compareChanges(changeType, subChange);

						let found = false;
						const access = accessor.filter(d => {
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
								model: root.model,
								series
							}
						);
					}
				));
			}
		));

		if (this.structure.settings.onChange && changeType){
			await this.structure.settings.onChange(changeType, series);
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
			this.structure.nexus,
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
	Document
};
