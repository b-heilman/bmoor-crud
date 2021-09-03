
const {get, set, del} =  require('bmoor/src/core.js');
const {create} = require('bmoor/src/lib/error.js');

const {Transformer} = require('bmoor-schema/src/Transformer.js');

const {compareChanges, config} = require('../schema/structure.js');

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
		await this.structure.link();

		await Promise.all(this.structure.subs.map(
			async (sub) => {
				sub.document = await sub.composite.nexus.loadDocument(sub.composite.name);
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
				await Promise.all(this.structure.subs.map(
					async ({info, path, joins, composite, document}) => {
						const query = joins.reduce(
							(agg, join) => {
								if (join.clear){
									clears.push(join.clear);
								}

								agg['.'+join.to] = get(queryDatum, path);

								return agg;
							}, 
							{}
						);

						// call the related document... I could do this up higher?
						const res = await document.query({
							params: query
						}, ctx);
						
						set(
							queryDatum,
							info.path,
							info.isArray ? res : res[0]
						);
					}
				));

				// TODO: figure out what to do about variables
				this.structure.calculateDynamics(queryDatum, {});

				// delete after incase there's a collision between subs
				clears.forEach(path => del(queryDatum, path));

				if (this.structure.encodeResults){
					return this.structure.encodeResults(queryDatum, ctx);
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
				[this.structure.baseModel.getKeyField()]: id
			}
		};

		return (
			await this.query(query, ctx)
		)[0];
	}

	async readAll(ctx){
		await this.link();

		return this.query({}, ctx);
	}

	async readMany(ids, ctx){
		await this.link();

		// so anything pass as param should always be passed as against the base
		// otherwise it should be a join...
		const query = {
			params: {
				[this.structure.baseModel.getKeyField()]: ids
			}
		};

		return this.query(query, ctx);
	}

	async normalize(incomingDatum, parentSession, ctx){
		if (!ctx){
			throw new Error('no ctx');
		}

		await this.link();

		const seriesSession = parentSession.getChildSession();
		const transitions = this.structure.fields
		.reduce(
			(agg, field) => {
				// variable is defined in composite, it lets us know this field
				// is only defined to join to another sub
				if (!field.incomingSettings.synthetic){
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
				}

				return agg;
			},
			{}
		);

		let changeType = config.get('changeTypes.none');

		const cbs = await Promise.all(
			Object.keys(transitions)
			.map(async (series) => {
				const trans = transitions[series];
				const transformer = new Transformer(trans.mappings);

				const service = await this.structure.nexus.loadCrud(trans.model);

				// I need to generate references for the second loop
				const content = await transformer.go(incomingDatum, {});
				
				let ref = null;
				let action = null;
				let writeType = null;
				
				const existing = await service.discoverDatum(content, ctx);
				if (existing){
					const key = service.structure.getKey(content);

					action = 'update';

					// If I put this inline below, I get null as an input
					const res = await service.getChangeType(content, key, ctx);
					changeType = compareChanges(changeType, res);
					writeType = config.get('writeModes.update');

					ref = new DatumRef(key);
				} else {
					changeType = config.get('changeTypes.major');
					writeType = config.get('writeModes.create');

					ref = new DatumRef();
					action = 'create';
				}

				const errors = await service.validate(content, writeType, ctx);

				if (errors.length){
					throw create(`validation failed for ${this.structure.name}`, {
						status: 400,
						code: 'BMOOR_CRUD_DOCUMENT_VALIDATE_CREATE',
						context: {
							model: service.structure.name,
							errors
						}
					});
				}

				const newDatum = seriesSession.defineDatum(
					series, ref, action, content
				);

				// generate a series of call back methods to be called once
				// everything is resolved
				return () => {
					const links = this.structure.instructions.getOutgoingLinks(series);
					
					// link to everything inside the known space... inside the 
					// current datum
					links.forEach(link => {
						const target = seriesSession.findLink(link.series);
						let datum =  null;

						if (target){
							datum = target;
						} else {
							datum = seriesSession.getStub(target);
						}

						newDatum.setField(
							link.local,
							target.getReference().getHash()
						);
					});
				};
			})
		);

		await Promise.all(cbs.map((cb) => cb()));
		
		await Promise.all(this.structure.subs.map(
			sub => {
				let content = get(incomingDatum, sub.info.path);
				
				if (!sub.info.isArray){
					content = [content];
				}
				
				// loop through all the results
				return Promise.all(content.map(
					async (subDatum) => {
						const {
							seriesSession: subSession,
							changeType: subChange
						} = await sub.document.normalize(subDatum, seriesSession, ctx);

						changeType = compareChanges(changeType, subChange);

						const mountPath = this.structure.instructions.getMount(sub.composite.name);

						mountPath.reduce(
							(prev, cur) => {
								const join = prev.join[cur.series];

								const direction = join.relationship.metadata.direction;
								const curModel = cur.model || 
									this.structure.nexus.getComposite(cur.composite).baseModel.name;
								const prevModel = prev.model;
								
								let left = null;
								let right = null;
								let field = null;

								if (direction === 'incoming'){
									left = curModel;
									right = prevModel;
									field = join.relationship.remote;
								} else { // outgoing
									left = prevModel;
									right = curModel;
									field = join.relationship.local;
								}

								// what if one of them doesn't exist?
								const target = subSession.findLink(left);
								let datum = null;

								if (target){
									datum = target;
								} else {
									datum = subSession.getStub(left);
								}

								const source = subSession.findLink(right);
								let s = null;

								if (source){
									s = source;
								} else {
									s = subSession.getStub(right);
								}

								datum.setField(field, s.getReference().getHash());

								return cur;
							}
						);
					}
				));
			}
		));

		if (this.structure.incomingSettings.onChange && changeType){
			await this.structure.incomingSettings.onChange(changeType, seriesSession, ctx);
		}
		
		return {
			seriesSession,
			changeType
		};
	}

	buildNormalizedSchema(){
		return new Normalized(this.structure.nexus);
	}

	async push(datum, ctx){
		const hooks = this.hooks;
		const instructions = this.buildNormalizedSchema();

		if (hooks.beforePush){
			await hooks.beforePush(datum, ctx, this);
		}

		await this.normalize(datum, instructions.getSession(), ctx);
		
		const rtn = await normalization.deflate(
			instructions,
			this.structure.nexus,
			ctx
		);

		if (hooks.afterPush){
			// TODO: do I need to make sure the key is there?
			let key = null;
			let rootModel = this.structure.base.structure.name;

			// the first instance of the root model SHOULD be the primary
			// object
			for(let i = 0, c = rtn.length; i < c && key===null; i++){
				if (rtn[i].model === rootModel){
					key = this.structure.base.getKey(rtn[i].datum);
				}
			}

			await hooks.afterPush([key], rtn, ctx, this);
		}

		return rtn;
	}

	async update(id, datum, ctx){
		set(datum, this.structure.baseModel.getKeyField(), id);

		return this.push(datum, ctx);
	}

	async create(datum, ctx){
		return this.push(datum, ctx);
	}

	async getAffectedByModel(modelName, key, ctx){
		const res = await super.read(
			{
				query: await this.structure.getKeyQueryByModel(
					modelName,
					key,
					ctx
				)
			}, 
			ctx
		);

		return res.map(response => response.key);
	}

	async getAffectedBySub(subName, key, ctx){
		const res = await super.read(
			{
				query: await this.structure.getKeyQueryBySub(
					subName,
					key,
					ctx
				)
			}, 
			ctx
		);

		return res.map(response => response.key);
	}
}

module.exports = {
	Document
};
