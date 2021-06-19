
const {get, set, del} =  require('bmoor/src/core.js');

const {Transformer} = require('bmoor-schema/src/Transformer.js');

const {compareChanges} = require('../schema/model.js');

const {View} = require('../services/view.js');

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

		this.subs = await Promise.all(this.structure.settings.subs.map(
			async (sub) => {
				const reference = sub.reference;

				return {
					document: await reference.composite.nexus.loadDocument(reference.name),
					reference,
					joins: sub.joins
				};
			}
		));
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
			async (queryDatum) => {
				const clears = [];

				// Loop through each result, and process the sub queries for each
				await Promise.all(this.subs.map(
					async (sub) => {
						const query = sub.joins.reduce(
							(agg, join) => {
								if (join.clear){
									clears.push(join.clear);
								}

								agg[join.path] = get(queryDatum, join.datumPath);

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
							queryDatum,
							property.base,
							property.isArray ? res : res[0]
						);
					}
				));

				// delete after incase there's a collision between subs
				clears.forEach(path => del(queryDatum, path));

				if (this.incomingSettings.encoding){
					return this.incomingSettings.encoding(queryDatum, ctx);
				} else {
					return queryDatum;
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

	async normalize(incomingDatum, instructions = null){
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
				const content = await transformer.go(incomingDatum, {});
				
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

				references[series] = ref;

				const newDatum = seriesSession.getDatum(series, ref, action);

				newDatum.setContent(content);

				// generate a series of call back methods to be called once
				// everything is resolved
				return () => {
					const connections = this.structure.connections[series];

					if (connections){
						connections.forEach(connection => {
							newDatum.setField(
								connection.local,
								references[connection.name]
							);
						});	
					}

					// TODO: validation?
					changeType = compareChanges(
						changeType, 
						service.structure.getChangeType(
							newDatum.getContent()
						)
					);
				};
			})
		);

		await cbs.map(cb => cb());

		/***
		 * Think I can get ride of all this
		 ***
		// I don't like this, but for now I'm gonna put hooks in that allow.
		// eventually I want this to be a function of getChangeType from model
		if (this.structure.incomingSettings.getChangeType){
			changeType = await this.structure.incomingSettings.getChangeType(seriesSession);
		}
		***/
		await Promise.all(this.subs.map(
			sub => {
				let content = get(incomingDatum, sub.reference.property.base);
				
				if (!sub.reference.property.isArray){
					content = [content];
				}
				
				const accessor = sub.joins[0].accessor;
				const root = sub.joins[0].root;

				return Promise.all(content.map(
					async (subDatum) => {
						const {
							seriesSession: subSeries,
							changeType: subChange
						} = await sub.document.normalize(subDatum, seriesSession);

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
			console.log(this.structure.name, '=>', changeType);
			await this.structure.incomingSettings.onChange(changeType, seriesSession);
		}
		
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
