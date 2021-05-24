
const {get, set, del} =  require('bmoor/src/core.js');

const {Transformer} = require('bmoor-schema/src/Transformer.js');

const {compareChanges} = require('../schema/model.js');

const {View} = require('../services/view.js');
const {Path} = require('../graph/path.js');

const {Normalized, DatumRef} = require('../schema/normalized.js');
const normalization = require('./normalization.js');

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

		this.base = await this.structure.nexus.getCrud(
			this.structure.incomingSettings.base
		);

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
				while(access.length && (
					this.structure.hasStructure(access[0].model) || 
					this.structure.incomingSettings.base === access[0].model
				)){
					prev = root;
					root = access.shift();
				}

				//let's verify the link is ok...
				const tail = access.length ? access[access.length-1] : root;

				const relationship = this.structure.nexus.mapper.getRelationship(
					tail.model, reference.composite.incomingSettings.base
				);

				let key = null;
				if (relationship){
					key = relationship.remote;
					tail.field = relationship.local;
				} else {
					throw new Error(tail.model+
						' can not connect to '+reference.composite.incomingSettings.base+
						': '+reference.property.statement
					);
				}

				// it can be assumed that everything at this point is already
				// connected
				const model = await this.structure.nexus.loadModel(root.model);
				let field = model.getField(root.field);
				let clear = null;

				if (!this.structure.hasField(field)){
					const ref = `sub_${i}`;
					
					field = await this.structure.addField(ref, {
						model: root.model, 
						extends: root.field,
						series: root.series
					});

					clear = ref;
				}
				
				access.push({
					loader: 'access',
					model: reference.composite.incomingSettings.base,
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

		this.structure.build();
	}

	/**
	 * 
	 **/
	async query(settings, ctx){
		await this.link();

		// prepare the query
		if (this._beforeQuery){
			await this._beforeQuery(settings.params, ctx);
		}

		const res = await super.read(
			{
				query: await this.structure.getQuery(
					settings,
					ctx
				)
			}, 
			ctx
		);
		
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
						const res = await sub.document.query({
							joins: query
						}, ctx);
						
						set(
							datum,
							property.base,
							property.isArray ? res : res[0]
						);
					}
				));

				// delete after incase there's a collision between subs
				clears.forEach(path => del(datum, path));

				if (this.incomingSettings.encoding){
					return this.incomingSettings.encoding(datum, ctx);
				} else {
					return datum;
				}
			}
		));
	}

	async read(id, ctx){
		await this.link();

		// so anything pass as param should always be passed as against the base
		// otherwise it should be a join...
		const query = {
			params: {
				[this.structure.incomingSettings.key]: id
			}
		};

		return (
			await this.query(query, ctx)
		)[0];
	}

	async normalize(datum, instructions = null){
		await this.link();

		if (!instructions){
			instructions = new Normalized(this.structure.nexus);
		}

		const transitions = this.structure.fields
		.reduce(
			(agg, field) => {
				const series = field.incomingSettings.series;

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

		const references = {};

		let changeType = null;

		const seriesSession = instructions.getSession();

		const cbs = await Promise.all(
			Object.keys(transitions)
			.map(async (series) => {
				const trans = transitions[series];

				const transformer = new Transformer(trans.mappings);

				const service = await this.structure.nexus.loadCrud(trans.model);

				// I need to generate references for the second loop
				const content = await transformer.go(datum, {});
				
				const key = service.structure.getKey(content);
				let ref = null;
				let action = null;

				if (key){
					if (typeof(key) === 'string' && key.charAt(0) === '$'){
						action = 'update-create';
					} else {
						action = 'update';
					}

					ref = new DatumRef(key);
				} else {
					ref = new DatumRef();
					action = 'create';
				}

				seriesSession.getDatum(series, ref, action)
					.setContent(content);

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

		// I don't like this, but for now I'm gonna put hooks in that allow.
		// eventually I want this to be a function of getChangeType from model
		if (this.structure.incomingSettings.getChangeType){
			changeType = await this.structure.incomingSettings.getChangeType(seriesSession);
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
						const {seriesSession: subSeries, changeType: subChange} = 
							await sub.document.normalize(subDatum, instructions);

						changeType = compareChanges(changeType, subChange);

						let found = false;
						console.log('subSeries', subSeries);
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
									datum = subSeries.stub(left);
								}

								const source = prev.seriesSession.get(right);
								let s = null;

								if (source){
									s = source[0];
								} else {
									s = subSeries.stub(right);
								}

								datum.setField(field, s.getReference());

								return {
									model: cur.model,
									seriesSession: subSeries
								};
							}, 
							{
								model: root.model,
								seriesSession
							}
						);
					}
				));
			}
		));

		if (this.structure.incomingSettings.onChange && changeType){
			await this.structure.incomingSettings.onChange(changeType, seriesSession);
		}

		console.log('-> seriesSession', seriesSession);

		return {
			seriesSession,
			instructions,
			changeType
		};
	}

	async push(datum, ctx){
		return normalization.deflate(
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
