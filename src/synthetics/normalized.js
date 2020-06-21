// TODO: this needs to be renamed as Normalized
// Synthetic will be a large denormalized schema based on smaller models
const {Network} = require('bmoor-data/src/model/Network.js');

async function getDatum(service, query, ctx){
	let key = service.model.getKey(query);

	// on update, a user might send a query object as the key if they are updating the name
	// in the body but not referencing by the id
	if (typeof(key) === 'object'){
		query = key;

		key = service.model.getKey(query);
	}

	if (key){
		// if you make key === 0, you're a horrible person
		return await service.read(key, ctx);
	} else {
		if (service.model.hasIndex()){
			return (await service.query(service.model.getIndex(query), ctx))[0];
		} else {
			return null;
		}
	}
}

async function install(action, service, master, mapper, ctx){
	let ref = action.$ref;
	let datum = null;

	if (action.$type === 'read'){
		// either search by key, or the whop thing sent in
		datum = await getDatum(service, action, ctx);
	} else if (action.$type === 'update'){
		// allows you to do something like update by name, but also change the name by overloading
		// the key
		const current = await getDatum(service, action, ctx);

		datum = await service.update(service.model.getKey(current), action, ctx);
	} else if (action.$type === 'create-or-update'){
		datum = await getDatum(service, action, ctx);

		if (datum){
			await service.update(service.model.getKey(datum), action, ctx);
		} else {
			datum = await service.create(action, ctx);
		}
	} else {
		datum = await service.create(action, ctx);
	}

	mapper.getByDirection(service.model.name, 'incoming')
	.forEach(link => {
		const targets = master[link.name];

		if (!targets){
			return;
		}

		targets.forEach(target => {
			if (target[link.remote] === ref){
				target[link.remote] = datum[link.local];
			}
		});
	});

	return datum;
}

// take a master datum, and a mapper reference to all classes, and convert that
// into a series of service calls

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
async function deflate(master, mapper, registry, ctx){
	const references = Object.keys(master);
	const network = new Network(mapper);

	const order = network.requirements(references, 1)
		.map(link => link.name);

	if (order.length !== references.length){
		throw new Error('magical pivot tables are not yet supported');
	}

	return order.reduce(
		(prom, serviceName) => {
			const service = registry.get(serviceName);

			return master[serviceName].reduce(
				(agg, datum) => agg.then(
					() => install(
						datum,
						service,
						master,
						mapper,
						ctx
					)
				), prom
			);
		}, Promise.resolve(true)
	);
}

async function getDatums(service, query, ctx){
	return typeof(query) === 'object' ? 
		await service.query(query, ctx) :
		await Promise.all([service.read(query, ctx)]);
}

async function inflate(service, query, mapper, registry, ctx){
	const known = {};
	const looking = {};
	const toProcess = query.keys.map(
		key => ({
			ref: null,
			query: key,
			service
		})
	);
	const joinModels = (query.join||[]).reduce((agg, table) => {
		agg[table] = true;

		return agg;
	}, {});
	const stubModels = (query.stub||[]).reduce((agg, table) => {
		agg[table] = true;

		return agg;
	}, {});
	
	let c = 0;
	function getLooking(serviceName, key){
		const service = registry.get(serviceName);
		let s = looking[service.model.name];

		if (!s){
			s = {};

			looking[service.model.name] = s;
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

	function addDatum(service, datum, type = 'create-or-update'){
		let s = known[service.model.name];

		if (!s){
			s = {};

			known[service.model.name] = s;
		}

		const field = service.model.properties.key;
		const key = datum[field];

		delete datum[field];
		datum.$type = type;

		let rtn = s[key];
		// TODO : if I do this, I should check the ref and replace that?
		if (rtn){
			return {
				current: rtn,
				isNew: false
			};
		} else {
			rtn = datum;
			s[key] = rtn;

			getLooking(service.model.name, key);

			return {
				current: rtn,
				isNew: true
			};
		}
	}

	do{
		const loading = toProcess.shift();
		const service = registry.get(loading.service);

		const datums = await getDatums(service, loading.query, ctx);

		const stubbed = !!stubModels[service.model.name];

		datums.forEach(datum => { // jshint ignore:line
			const key = service.model.getKey(datum);
			const {current, isNew} = addDatum(
				service,
				datum,
				stubbed ? 'read' : 'create-or-update'
			);

			if (!isNew){
				return true;
			}

			//------- process outgoing links
			if (!stubbed){
				mapper.getByDirection(service.model.name, 'outgoing')
				.forEach(link => { // jshint ignore:line
					const fk = current[link.local];

					if (fk !== null){
						const {ref, newish} = getLooking(link.name, fk); // jshint ignore:line
						
						if (newish){
							toProcess.push({
								ref: ref,
								service: link.name,
								query: {[link.remote]: fk}
							});
						}

						current[link.local] = ref;
					}
				});

				//------- process incoming links
				const {ref} = getLooking(service.model.name, key);
				current.$ref = ref;

				mapper.getByDirection(service.model.name, 'incoming')
				.forEach(link => {
					if (joinModels[link.name]){
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

			//------- now that we've processed, we can change data, otherwise things get mixed up up above
			if (loading.back){
				current[loading.back] = loading.ref;
			} else if (loading.ref){
				current.$ref = loading.ref;
			}
		});
	}while(toProcess.length);

	Object.keys(known).forEach(key => {
		known[key] = Object.values(known[key]);
	});

	return known;
}

async function diagram(service, keys, mapper, registry, ctx){
	const known = {};
	const looking = {};
	const toProcess = keys.map(
		key => ({
			query: {
				[registry.get(service).model.properties.key]: key
			},
			service
		})
	);
	
	function addDatum(service, datum){
		let s = known[service.model.name];
		
		if (!s){
			s = {};

			known[service.model.name] = s;
		}

		const key = service.model.getKey(datum);

		if (!s[key]){
			s[key] = datum;

			return true;
		} else {
			return false;
		}
	}

	do {
		const loading = toProcess.shift();
		const service = registry.get(loading.service);

		const results = await service.query(loading.query, ctx);  

		results.forEach(datum => { // jshint ignore:line
			if (addDatum(service, datum)){ 
				mapper.getByDirection(service.model.name, 'outgoing')
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

async function clear(master, mapper, registry, ctx){
	const references = Object.keys(master);
	const network = new Network(mapper);

	let order = network.requirements(references, 1)
		.reverse() // you don't want to lead with a leaf, so switch
		.map(link => link.name);

	if (order.length !== references.length){
		throw new Error('magical pivot tables are not yet supported');
	}

	order = order.reverse();

	return order.reduce(
		(prom, serviceName) => {
			const service = registry.get(serviceName);

			return master[serviceName].reduce(
				(agg, datum) => agg.then(
					() => service.delete(datum, ctx)
				), prom
			);
		}, Promise.resolve(true)
	);
}

module.exports = {
	inflate,
	deflate,
	diagram,
	clear
};
