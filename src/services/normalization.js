
const {create} = require('bmoor/src/lib/error.js');

const {Normalized} = require('../schema/normalized.js');
const {Network} = require('../graph/network.js');

async function getDatum(service, query, ctx){
	return service.discoverDatum(query, ctx);
}

async function ensure(mapper, modelName, payload, ctx){
	return Promise.all(mapper.getByDirection(modelName, 'outgoing')
	.map( 
		async (link) => {
			if (link.local in payload){
				const value = payload[link.local];

				// if it's a DatumRef, what will the value be?
				if (typeof(value) === 'string'){
					// this means it's a reference string
					let foreign = await ctx.waitlist.await(link.name, value);

					payload[link.local] = foreign.key;
				}
			}
		},
		Promise.resolve(true)
	));
}

async function install(datum, service, master, mapper, ctx){
	let ref = datum.getReference();
	let rtn = null;
	let action = null;

	if (datum.getAction() === 'read'){
		// either search by key, or the whop thing sent in
		rtn = await getDatum(service, datum.getContent(), ctx);

		action = 'read';

		if (!rtn){
			throw create(`unable to read expected datum of type ${service.structure.name}`, {
				status: 406,
				code: 'BMOOR_CRUD_NORMALIZED_INSTALL_READ',
				context: {
					name: service.structure.name,
					action: datum.getAction()
				}
			});
		}
	} else {
		const content = datum.getContent();
		const modelName = service.structure.name;

		await ensure(mapper, modelName, content, ctx);
		
		if (datum.getAction() === 'update'){
			// allows you to do something like update by name, but also change the name by overloading
			// the key
			const current = await getDatum(service, content, ctx);

			if (!current){
				throw create(`unable to update expected datum of type ${modelName}`, {
					status: 406,
					code: 'BMOOR_CRUD_NORMALIZED_INSTALL_UPDATE',
					context: {
						name: modelName,
						action: datum.getAction()
					}
				});
			}

			action = 'update';
			rtn = await service.update(service.structure.getKey(current), content, ctx);
		} else if (datum.getAction() === 'update-create'){
			rtn = await getDatum(service, content, ctx);
			
			if (rtn){
				action = 'update';
				await service.update(service.structure.getKey(rtn), content, ctx);
			} else {
				action = 'create';
				rtn = await service.create(content, ctx);
			}
		}  else if (datum.getAction() === 'read-create'){
			rtn = await getDatum(service, content, ctx);

			action = 'read';
			if (!rtn){
				action = 'create';
				rtn = await service.create(content, ctx);
			}
		} else {
			action = 'create';
			
			rtn = await service.create(content, ctx);
		}
	}

	// when this thing is processed, update any references to it
	ctx.waitlist.resolve(service, ref, rtn);

	return {
		action,
		datum: rtn
	};
}

/**
{
	[service-name]: [{
		$ref: <reference>,
		$type: [create, read, update],
		[model.key]: <value>,
		... rest of datum
	}]
}
**/
// pushes to data source
async function deflate(schema, nexus, ctx){
	let master = null;

	//deep copy master
	if (schema instanceof Normalized){
		master = schema;
	} else {
		master = new Normalized(nexus);
		
		master.import(schema);
	}

	// If I don't do this, I can make alterations to the incoming data, causing a possible
	// mutation.  I might make this an option in the future to not run if you want to save
	// data
	master = master.clone();

	// for now, I'm going to convert it back.  In the future I will write this
	//  to 
	const references = Array.from(master.keys());
	if (!ctx){
		throw create(`missing ctx in deflate`, {
			status: 404,
			code: 'BMOOR_CRUD_SERVICE_READ_FILTER',
			context: {
				references
			}
		});
	}

	const network = new Network(nexus.mapper);

	const order = network.requirements(references, 1, {
		join: schema.join,
		stub: schema.stub
	}).map(link => link.name);

	if (order.length !== references.length){
		throw new Error('magical pivot tables are not yet supported');
	}

	return order.reduce(
		async (prom, serviceName) => {
			const service = await nexus.loadCrud(serviceName);

			return master.get(serviceName).toArray()
			.reduce(
				async (prom, datum) => {
					const agg = await prom;

					const res = await install(
						datum,
						service,
						master,
						nexus.mapper,
						ctx
					);

					res.model = serviceName;

					agg.push(res);

					return agg;
				}, 
				prom
			);
		}, 
		Promise.resolve([])
	);
}

async function getDatums(service, query, ctx){
	return typeof(query) === 'object' ? 
		await service.query(query, ctx) :
		await Promise.all([service.read(query, ctx)]);
}

// pull from data source
async function inflate(service, query, nexus, ctx){
	const known = {};
	const looking = {};
	const toProcess = query.keys.map(
		key => ({
			ref: null,
			query: key,
			service
		})
	);
	const joinModels = Object.keys(query.join||[]).reduce(
		(agg, model) => {
			const tables = query.join[model];

			agg[model] = tables.reduce(
				(agg, table) => {
					agg[table] = true;

					return agg;
				},
				{}
			);

			return agg;
		}, 
		{}
	);
	const stubModels = (query.stub||[]).reduce( // read
		(agg, table) => {
			agg[table] = true;

			return agg;
		},
		{}
	);
	const ensureModels = (query.ensure||[]).reduce( // read-create, no update
		(agg, table) => {
			agg[table] = true;

			return agg;
		},
		{}
	);
	
	let c = 0;
	async function getLooking(serviceName, key){
		const service = await nexus.loadCrud(serviceName);
		let s = looking[service.structure.name];

		if (!s){
			s = {};

			looking[service.structure.name] = s;
		}

		let ref = s[key];
		let newish = false;

		if (!ref){
			ref = 'ref-'+(c++);

			s[key] = ref;
			newish = true;
		}

		return {
			ref,
			newish
		};
	}

	async function addDatum(service, datum, type = 'update-create'){
		let s = known[service.structure.name];

		if (!s){
			s = {};

			known[service.structure.name] = s;
		}

		const field = service.structure.settings.key;
		const key = datum[field];

		delete datum[field];
		datum.$type = type;

		let rtn = s[key];
		
		if (rtn){
			return {
				current: rtn,
				isNew: false
			};
		} else {
			rtn = datum;
			s[key] = rtn;

			await getLooking(service.structure.name, key);

			return {
				current: rtn,
				isNew: true
			};
		}
	}

	do{
		const loading = toProcess.shift();
		const service = await nexus.loadCrud(loading.service);

		const datums = await getDatums(service, loading.query, ctx);

		const stubbed = !!stubModels[service.structure.name];
		const ensured = !!ensureModels[service.structure.name];

		await Promise.all(
			datums.map(async (datum) => { // jshint ignore:line
				const key = service.structure.getKey(datum);
				const {current, isNew} = await addDatum(
					service,
					datum,
					ensured ? 'read-create' : (stubbed ? 'read' : 'update-create')
				);

				if (!isNew){
					return true;
				}

				//------- process links as long as not stubbed
				if (!stubbed){
					// always load outgoing link
					await Promise.all(
						nexus.mapper.getByDirection(service.structure.name, 'outgoing')
						.map(async (link) => { // jshint ignore:line
							const fk = current[link.local];

							if (fk !== null){
								const {ref, newish} = await getLooking(link.name, fk); // jshint ignore:line
								
								if (newish){
									toProcess.push({
										ref: ref,
										service: link.name,
										query: {[link.remote]: fk}
									});
								}

								current[link.local] = ref;
							}
						})
					);

					const {ref} = await getLooking(service.structure.name, key);
					current.$ref = ref;

					// optionally load incoming links
					const lookup = joinModels[service.structure.name];
					if (lookup){
						nexus.mapper.getByDirection(service.structure.name, 'incoming')
						.forEach(link => {
							if (lookup[link.name]){
								toProcess.push({
									ref: ref,
									back: link.remote,
									service: link.name,
									query: {
										[link.remote]: key
									}
								});
							}
						});
					}
				}

				//------- now that we've processed, we can change data, otherwise things get mixed up up above
				if (loading.back){
					current[loading.back] = loading.ref;
				} else if (loading.ref){
					current.$ref = loading.ref;
				}
			})
		);
	}while(toProcess.length);

	Object.keys(known).forEach(key => {
		known[key] = Object.values(known[key]);
	});

	return known;
}

async function diagram(service, keys, nexus, ctx){
	const known = {};
	const looking = {};
	const toProcess = await Promise.all(
		keys.map(
			async (key) => ({
				query: {
					[(await nexus.loadCrud(service)).schema.properties.key]: key
				},
				service
			})
		)
	);
	
	function addDatum(service, datum){
		let s = known[service.structure.name];
		
		if (!s){
			s = {};

			known[service.structure.name] = s;
		}

		const key = service.structure.getKey(datum);

		if (!s[key]){
			s[key] = datum;

			return true;
		} else {
			return false;
		}
	}

	do {
		const loading = toProcess.shift();
		const service = await nexus.loadCrud(loading.service);
		const results = await service.query(loading.query, ctx);  

		results.forEach(datum => { // jshint ignore:line
			if (addDatum(service, datum)){ 
				nexus.mapper.getByDirection(service.structure.name, 'outgoing')
				.forEach(link => {
					const s = link.name;
					const r = link.remote;
					const k = datum[link.local];

					if (k !== null){
						const hash = `${s} - ${r} - ${k}`;

						if (!looking[hash]){
							looking[hash] = true;

							toProcess.push({
								query: {
									[r]: datum[k]
								},
								service: s
							});
						}
					}
				});
			}
		});
	} while(toProcess.length);

	Object.keys(known).forEach(key => {
		known[key] = Object.values(known[key]);
	});

	return known;
}

async function clear(master, nexus, ctx){
	const references = Object.keys(master);
	const network = new Network(nexus.mapper);

	let order = network.requirements(references, 1)
		.reverse() // you don't want to lead with a leaf, so switch
		.map(link => link.name);

	if (order.length !== references.length){
		throw new Error('magical pivot tables are not yet supported');
	}

	order = order.reverse();

	return order.reduce(
		async (prom, serviceName) => {
			const service = await nexus.loadCrud(serviceName);

			return master[serviceName].reduce(
				(agg, datum) => agg.then(
					() => service.delete(datum, ctx)
				), 
				prom
			);
		}, 
		Promise.resolve(true)
	);
}

module.exports = {
	getDatum,
	inflate,
	deflate,
	diagram,
	clear
};
