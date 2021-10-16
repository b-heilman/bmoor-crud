
const {expect} = require('chai');
const sinon = require('sinon');

const {config} = require('../schema/structure.js');
const {Model} = require('../schema/model.js');
const {Crud} = require('./crud.js');
const {Nexus} = require('../env/nexus.js');
const {Context} = require('../server/context.js');

describe('src/services/crud.js', function(){
	let stubs = null;
	let nexus = null;
	let context = null;
	let connector = null;

	let permissions = null;

	beforeEach(async function(){
		stubs = {};

		permissions = {};

		context = new Context({method: 'get'});
		context.hasPermission =  (perm) => !!permissions[perm];

		nexus = new Nexus();

		connector = {
			// this doesn't matter here, right?
		};

		await nexus.setConnector('test', async () => connector);

		await nexus.configureSource('test-1', {
			connector: 'test'
		});
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => {
			if (stub.restore){
				stub.restore();
			}
		});
	});

	describe('::clean', function(){
		// right now this is covered by forge's old code
	});

	describe('::buildCleaner', function(){
		let model = null;
		let service = null;

		beforeEach(async function(){
			model = new Model('model-1', nexus);

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: 'regular',
						update: 'regular',
						delete: 'admin',
						index: 'regular'
					},
					title: {
						create: 'admin',
						read: 'admin',
						update: 'admin'
					},
					hello: {
						create: 'regular',
						read: 'regular',
						query: 'regular'
					}
				}
			});

			service = new Crud(model);
		});
		// right now this is covered by forge's old code
		describe('for create', function(){
			let cleaner = null;

			beforeEach(async function(){
				cleaner = service.buildCleaner('create');
			});

			it('should clean anything that needs permissions', async function(){
				permissions = {};

				const datum = {
					id: 1,
					name: 'name-1',
					title: 'title-1',
					hello: 'world'
				};

				const res = await cleaner(datum, context);

				expect(res)
				.to.deep.equal({
					id: 1,
					name: 'name-1'
				});
			});

			it('should work with regular permissions', async function(){
				permissions = {
					regular: true
				};

				const datum = {
					id: 1,
					name: 'name-1',
					title: 'title-1',
					hello: 'world'
				};

				const res = await cleaner(datum, context);

				expect(res)
				.to.deep.equal({
					id: 1,
					name: 'name-1',
					hello: 'world'
				});
			});

			it('should work with admin permissions', async function(){
				permissions = {
					regular: true,
					admin: true
				};

				const datum = {
					id: 1,
					name: 'name-1',
					title: 'title-1',
					hello: 'world'
				};

				const res = await cleaner(datum, context);

				expect(res)
				.to.deep.equal({
					id: 1,
					name: 'name-1',
					title: 'title-1',
					hello: 'world'
				});
			});
		});

		describe('for read', function(){
			let cleaner = null;

			beforeEach(async function(){
				cleaner = await service.buildCleaner('read');
			});

			it('should clean anything that needs permissions', async function(){
				permissions = {};

				const datum = {
					id: 1,
					name: 'name-1',
					title: 'title-1',
					hello: 'world'
				};

				const res = await cleaner(datum, context);

				expect(res)
				.to.deep.equal({
					id: 1
				});
			});

			it('should clean with regular permissions', async function(){
				permissions = {
					regular: true
				};

				const datum = {
					id: 1,
					name: 'name-1',
					title: 'title-1',
					hello: 'world'
				};

				const res = await cleaner(datum, context);

				expect(res)
				.to.deep.equal({
					id: 1,
					name: 'name-1',
					hello: 'world'
				});
			});

			it('should clean with just admin permissions', async function(){
				permissions = {
					admin: true
				};

				const datum = {
					id: 1,
					name: 'name-1',
					title: 'title-1',
					hello: 'world'
				};

				const res = await cleaner(datum, context);

				expect(res)
				.to.deep.equal({
					id: 1,
					title: 'title-1'
				});
			});

			it('should clean with full admin permissions', async function(){
				permissions = {
					regular: true,
					admin: true
				};

				const datum = {
					id: 1,
					name: 'name-1',
					title: 'title-1',
					hello: 'world'
				};

				const res = await cleaner(datum, context);

				expect(res)
				.to.deep.equal({
					id: 1,
					name: 'name-1',
					title: 'title-1',
					hello: 'world'
				});
			});
		});
	});

	describe('::create', function(){
		it('should basically work', async function(){
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);

				expect(request)
				.to.deep.equal({
					method: 'create',
					models: [{
						series: 'model-1',
						schema: 'model-1',
						payload: {
							name: 'name-1',
							title: 'title-1',
							json: '{"hello":"world"}'
						}
					}],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'name',
						path: 'name'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}, {
						series: 'model-1',
						as: 'json',
						path: 'json'
					}],
					filters: [],
					params: []
				});

				return Promise.resolve([{
					id: 'something-1',
					value: 'v-1',
					json: '{"foo":"bar"}'
				}]);
			};

			const model = new Model('model-1', nexus);

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						delete: true,
						index: true
					},
					title: {
						create: true,
						read: true,
						update: true
					},
					json: {
						create: true,
						read: true,
						update: true,
						usage: 'json'
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			return service.create({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk',
				json: {
					hello: 'world'
				}
			}, context)
			.then(res => {
				expect(res)
				.to.deep.equal({
					id: 'something-1',
					json: {
						foo: 'bar'
					}
				});
			});
		});

		it('should not fail if a type field is blank', async function(){
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);

				expect(request)
				.to.deep.equal({
					method: 'create',
					models: [{
						series: 'model-1',
						schema: 'model-1',
						payload: {
							name: 'name-1',
							title: 'title-1'
						}
					}],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'name',
						path: 'name'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}, {
						series: 'model-1',
						as: 'json',
						path: 'json'
					}],
					filters: [],
					params: []
				});

				return Promise.resolve([{
					id: 'something-1',
					value: 'v-1'
				}]);
			};

			const model = new Model('model-1', nexus);

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						delete: true,
						index: true
					},
					title: {
						create: true,
						read: true,
						update: true
					},
					json: {
						create: true,
						read: true,
						update: true,
						usage: 'json'
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			return service.create({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk'
			}, context)
			.then(res => {
				expect(res).to.deep.equal({
					id: 'something-1'
				});
			});
		});
	});

	describe('::read', function(){
		it('should basically work', async function(){
			const model = new Model('model-1', nexus);

			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				expect(request)
				.to.deep.equal({
					method: 'read',
					sourceName: 'test-1',
					models: [{
						series: 'model-1',
						schema: 'model-1',
						joins: []
					}],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'name',
						path: 'name'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}, {
						series: 'model-1',
						as: 'json',
						path: 'json'
					}],
					filters: [],
					params: [{
						series: 'model-1',
						path: 'id',
						operation: '=',
						value: 123,
						settings: {}
					}]
				});

				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
					json: '{"foo":"bar"}'
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						delete: true,
						index: true
					},
					title: {
						create: true,
						read: true,
						update: true
					},
					json: {
						read: true,
						usage: 'json'
					}
				}
			});

			const service = new Crud(model);

			service.configure();

			return service.read(123, context)
			.then(res => {
				expect(res).to.deep.equal({
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
					json: {
						foo: 'bar'
					}
				});
			});
		});

		it('should work with a map function', async function(){
			let response = null;
			
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				return Promise.resolve([response]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						read: true
					},
					name: {
						read: 'user'
					},
					title: {
						read: 'admin'
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			//----------------
			response = {
				id: 'something-1',
				name: 'v-1',
				title: 't-1'
			};
			permissions = {};

			const res1 = await service.read(123, context, {noCache: true});
			
			expect(res1)
			.to.deep.equal({
				id: 'something-1'
			});

			//----------------
			response = {
				id: 'something-2',
				name: 'v-2',
				title: 't-2'
			};
			permissions = {
				user: true
			};

			const res2 = await service.read(123, context, {noCache: true});
			
			expect(res2)
			.to.deep.equal({
				id: 'something-2',
				name: 'v-2'
			});

			//----------------
			response = {
				id: 'something-3',
				name: 'v-3',
				title: 't-3'
			};
			permissions = {
				user: false
			};

			const res3 = await service.read(123, context, {noCache: true});
			
			expect(res3)
			.to.deep.equal({
				id: 'something-3'
			});

			//----------------
			response = {
				id: 'something-4',
				name: 'v-4',
				title: 't-4',
				foo: 'bar'
			};
			permissions = {
				user: false,
				admin: true
			};

			const res4 = await service.read(123, context, {noCache: true});
			
			expect(res4)
			.to.deep.equal({
				id: 'something-4',
				title: 't-4'
			});
		});
	});

	describe('::readAll', function(){
		it('should basically work', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				expect(request)
				.to.deep.equal({
					method: 'read',
					sourceName: 'test-1',
					models: [{
						series: 'model-1',
						schema: 'model-1',
						joins: []
					}],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}, {
						series: 'model-1',
						as: 'json',
						path: 'json'
					}],
					filters: [],
					params: []
				});

				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
					foo: 'bar'
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						read: true
					},
					name: {
						read: false
					},
					title: {
						read: true
					},
					json: {
						read: true,
						usage: 'json'
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			return service.readAll(context)
			.then(res => {
				// this illustrates a good point, I am not doing a clean on the
				// data returned from the execution 
				expect(res)
				.to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1'
				}]);
			});
		});

		it('should work with a type', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				expect(request.method)
				.to.equal('read');

				expect(request.query)
				.to.deep.equal({
					sourceName: 'test-1',
					models: [{
						series: 'model-1',
						schema: 'model-1',
						joins: []
					}],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}, {
						series: 'model-1',
						as: 'json',
						path: 'json'
					}],
					filters: [],
					params: []
				});

				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
					foo: 'bar',
					json: '{"hello":"world"}'
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						read: true
					},
					name: {
						read: false
					},
					title: {
						read: true
					},
					json: {
						read: true,
						usage: 'json'
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			service.readAll(context)
			.then(res => {
				// this illustrates a good point, I am not doing a clean on the
				// data returned from the execution, but am an inflate
				expect(res)
				.to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
					json: {
						hello: 'world'
					}
				}]);
			});
		});

		it('should work with permissions', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
					foo: 'bar'
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						read: true
					},
					name: {
						read: 'user'
					},
					title: {
						read: 'admin'
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			permissions = {
				user: true
			};

			return service.readAll(context)
			.then(res => {
				// this illustrates a good point, I am not doing a clean on the
				// data returned from the execution 
				expect(res)
				.to.deep.equal([{
					id: 'something-1',
					name: 'v-1'
				}]);
			});
		});
	});

	describe('::readMany', function(){
		it('should basically work', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				expect(request)
				.to.deep.equal({
					method: 'read',
					sourceName: 'test-1',
					models: [{
						series: 'model-1',
						schema: 'model-1',
						joins: []
					}],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'name',
						path: 'name'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}],
					filters: [],
					params: [{
						series: 'model-1',
						path: 'id',
						operation: '=',
						value: [1,2,3],
						settings: {}
					}]
				});

				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						delete: true,
						index: true
					},
					title: {
						create: true,
						read: true,
						update: true
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			return service.readMany([1,2,3], context)
			.then(res => {
				expect(res).to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			});
		});

		it('should work with permissions', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
					foo: 'bar'
				}]);
			}; 

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						read: true
					},
					name: {
						read: 'user'
					},
					title: {
						read: 'admin'
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			permissions = {
				user: true
			};

			return service.readMany([1,2], context)
			.then(res => {
				// this illustrates a good point, I am not doing a clean on the
				// data returned from the execution 
				expect(res)
				.to.deep.equal([{
					id: 'something-1',
					name: 'v-1'
				}]);
			});
		});
	});

	describe('::query', function(){
		it('should basically work', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				expect(request)
				.to.deep.equal({
					method: 'read',
					sourceName: 'test-1',
					models: [{
						series: 'model-1',
						schema: 'model-1',
						joins: []
					}],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'name',
						path: 'name'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}],
					filters: [],
					params: [{
						series: 'model-1',
						path: 'name',
						operation: '=',
						value: 'test-1',
						settings: {}
					}]
				});

				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						delete: true,
						query: true
					},
					title: {
						create: true,
						read: true,
						update: true
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			return service.query({
				params: {
					name: 'test-1'
				}
			}, context).then(res => {
				expect(res).to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			});
		});

		it('should pass through', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				expect(request)
				.to.deep.equal({
					method: 'read',
					sourceName: 'test-1',
					models: [{
						series: 'model-1',
						schema: 'model-1',
						joins: []
					}],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'name',
						path: 'name'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}],
					filters: [],
					params: [{
						series: 'model-1',
						path: 'id',
						operation: '=',
						value: 1,
						settings: {}
					}, {
						series: 'model-1',
						path: 'name',
						operation: 'gt',
						value: 'test-1.1',
						settings: {}
					}, {
						series: 'model-1',
						path: 'name',
						operation: 'lt',
						value: 'test-1.9',
						settings: {}
					}, {
						series: 'model-1',
						path: 'title',
						operation: '=',
						value: 'title-1',
						settings: {}
					}]
				});

				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						delete: true,
						query: true
					},
					title: {
						create: true,
						read: true,
						update: true
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			return service.query(
				{
					params: {
						id: 1,
						name: {
							gt: 'test-1.1',
							lt: 'test-1.9'
						},
						title: 'title-1'
					}
				}, context
			).then(res => {
				expect(res).to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			});
		});

		it('should work with permissions', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
					foo: 'bar'
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						read: true
					},
					name: {
						read: 'user'
					},
					title: {
						read: 'admin'
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			permissions = {
				user: true
			};

			return service.query({}, context)
			.then(res => {
				// this illustrates a good point, I am not doing a clean on the
				// data returned from the execution 
				expect(res)
				.to.deep.equal([{
					id: 'something-1',
					name: 'v-1'
				}]);
			});
		});
	});

	describe('::update', function(){
		it('should basically work', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);
				
				expect(request)
				.to.deep.equal({
					method: 'update',
					models: [
						{
							series: 'model-1',
							schema: 'model-1',
							payload: {
								name: 'test-1',
								title: 'title-1'
							}
						}
					],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'name',
						path: 'name'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}],
					filters: [],
					params: [
						{
							series: 'model-1',
							path: 'id',
							operation: '=',
							value: '1',
							settings: {}
						}
					]
				});

				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						delete: true,
						index: true
					},
					title: {
						create: true,
						read: true,
						update: true
					},
					json: {
						update: true,
						usage: 'json'
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			stubs.read = sinon.stub(service, 'read')
			.resolves({id:123});

			return service.update('1', 
				{
					id: 1,
					name: 'test-1',
					title: 'title-1'
				},
				context
			).then(res => {
				expect(res).to.deep.equal({
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				});

				expect(stubs.read.getCall(0).args[0])
				.to.equal('1');
			});
		});

		it('should work with types', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);

				expect(request)
				.to.deep.equal({
					method: 'update',
					models: [
						{
							series: 'model-1',
							schema: 'model-1',
							payload: {
								name: 'test-1',
								title: 'title-1',
								json: '{"hello":"world"}'
							}
						}
					],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'name',
						path: 'name'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}],
					filters: [],
					params: [
						{
							series: 'model-1',
							path: 'id',
							operation: '=',
							value: '1',
							settings: {}
						}
					]
				});

				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
					json: '{"foo":"bar"}'
				}]);
			}; 

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						delete: true,
						index: true
					},
					title: {
						create: true,
						read: true,
						update: true
					},
					json: {
						update: true,
						usage: 'json'
					}
				}
			});

			const service = new Crud(model);

			service.configure();

			stubs.read = sinon.stub(service, 'read')
			.resolves({id:123});

			return service.update('1', 
				{
					id: 1,
					name: 'test-1',
					title: 'title-1',
					json: {
						hello: 'world'
					}
				},
				context
			).then(res => {
				expect(res).to.deep.equal({
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
					json: {
						foo: 'bar'
					}
				});

				expect(stubs.read.getCall(0).args[0])
				.to.equal('1');
			});
		});
	});

	describe('::delete', function(){
		it('should basically work', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);

				expect(request)
				.to.deep.equal({
					method: 'delete',
					models: [{
						series: 'model-1',
						schema: 'model-1'
					}],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'name',
						path: 'name'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}],
					filters: [],
					params: [{
						series: 'model-1',
						path: 'id',
						operation: '=',
						value: '1',
						settings: {}
					}]
				});

				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						delete: true,
						index: true
					},
					title: {
						create: true,
						read: true,
						update: true
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			stubs.read = sinon.stub(service, 'read')
			.resolves({id: 123});

			return service.delete('1', context)
			.then(res => {
				expect(res).to.deep.equal({
					id: 123
				});

				expect(stubs.read.getCall(0).args[0])
				.to.equal('1');
			});
		});
	});

	describe('::decorate', function(){
		it('should basically work', async function(){
			const model = new Model('model-1', nexus);
			
			connector.execute = async function(request, myCtx){
				expect(myCtx)
				.to.equal(context);

				expect(request)
				.to.deep.equal({
					method: 'delete',
					models: [{
						series: 'model-1',
						schema: 'model-1'
					}],
					fields: [{
						series: 'model-1',
						as: 'id',
						path: 'id'
					}, {
						series: 'model-1',
						as: 'name',
						path: 'name'
					}, {
						series: 'model-1',
						as: 'title',
						path: 'title'
					}],
					filters: [],
					params: [{
						series: 'model-1',
						path: 'id',
						operation: '=',
						value: '1',
						settings: {}
					}]
				});

				return Promise.resolve([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			};

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						delete: true,
						index: true
					},
					title: {
						create: true,
						read: true,
						update: true
					}
				}
			});

			const service = new Crud(model);

			await service.configure();

			let wasSupered = false;

			service.decorate({
				superDelete: async function(id, context){
					expect(id).to.equal('1');

					wasSupered = true;

					return this.delete(id, context);
				}
			});

			stubs.read = sinon.stub(service, 'read')
			.resolves({id: 123});

			return service.superDelete('1', context)
			.then(res => {
				expect(res).to.deep.equal({
					id: 123
				});

				expect(stubs.read.getCall(0).args[0])
				.to.equal('1');
			});
		});
	});

	describe('::getChangeType', function(){
		it('should run when the id is null', async function(){
			const model = new Model('model-1', nexus);

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						updateType: config.get('changeTypes.major')
					},
					title: {
						create: true,
						read: true,
						update: true,
						updateType: config.get('changeTypes.minor')
					},
					someField: {
						create: true,
						read: true,
						update: true
					}
				}
			});

			const service = new Crud(model);

			let res = await service.getChangeType({junk: true});

			expect(res)
			.to.equal(config.get('changeTypes.none'));

			res = await service.getChangeType({someField: true});

			expect(res)
			.to.equal(config.get('changeTypes.none'));

			res = await service.getChangeType({
				someField: true,
				title: true
			});

			expect(res)
			.to.equal(config.get('changeTypes.minor'));

			res = await service.getChangeType({
				someField: true,
				title: true,
				name: true
			});

			expect(res)
			.to.equal(config.get('changeTypes.major'));
		});

		it('should run when the id is null', async function(){
			const model = new Model('model-1', nexus);

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						updateType: config.get('changeTypes.major')
					},
					title: {
						create: true,
						read: true,
						update: true,
						updateType: config.get('changeTypes.minor')
					},
					someField: {
						create: true,
						read: true,
						update: true
					}
				}
			});

			const service = new Crud(model);

			stubs.read = sinon.stub(service, 'read');

			stubs.read.resolves({foo: 'bar'});

			let res = await service.getChangeType({junk: true}, 1);

			expect(res)
			.to.equal(config.get('changeTypes.none'));
			
			//-------
			stubs.read.resolves({someField: true});

			res = await service.getChangeType({someField: true}, 1);

			expect(res)
			.to.equal(config.get('changeTypes.none'));

			stubs.read.resolves({someField: false});

			res = await service.getChangeType({someField: true}, 1);

			expect(res)
			.to.equal(config.get('changeTypes.none'));

			//--------
			stubs.read.resolves({someField: true, title:true});

			res = await service.getChangeType({
				someField: true,
				title: true
			}, 1);

			expect(res)
			.to.equal(config.get('changeTypes.none'));

			stubs.read.resolves({someField: true, title:false});

			res = await service.getChangeType({
				someField: true,
				title: true
			}, 1);

			expect(res)
			.to.equal(config.get('changeTypes.minor'));

			//--------
			stubs.read.resolves({someField: true, title: true, name: true});

			res = await service.getChangeType({
				someField: true,
				title: true,
				name: true
			}, 1);

			expect(res)
			.to.equal(config.get('changeTypes.none'));

			stubs.read.resolves({someField: false, title: true, name: true});

			res = await service.getChangeType({
				someField: true,
				title: true,
				name: true
			}, 1);

			expect(res)
			.to.equal(config.get('changeTypes.none'));

			stubs.read.resolves({someField: true, title: false, name: true});

			res = await service.getChangeType({
				someField: true,
				title: true,
				name: true
			}, 1);

			expect(res)
			.to.equal(config.get('changeTypes.minor'));

			stubs.read.resolves({someField: true, title: false, name: false});

			res = await service.getChangeType({
				someField: true,
				title: true,
				name: true
			}, 1);

			expect(res)
			.to.equal(config.get('changeTypes.major'));
		});
	});

	describe('::validate', function(){
		let context = null;
		let payload = null;
		let service = null;

		beforeEach(async function(){
			context = new Context();

			connector.execute = async (request) => {
				expect(request)
				.to.deep.equal(payload);

				return [{
					id: 'something-1',
					junk: 'v-1',
					title: 't-2'
				}];
			};

			const model = new Model('model-1', nexus);

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					junk: {
						read: true,
						create: true,
						update: true
					},
					name: {
						create: true,
						read: true,
						update: true,
						validation: {
							required: true
						}
					},
					title: {
						create: true,
						read: true,
						update: true,
						validation: {
							required: true
						}
					}
				}
			});

			service = new Crud(model);

			await service.configure();
		});

		it('should properly pass when called directly', async function(){
			let res = null;

			res = await service.validate(
				{junk: 1, name: 2, title: 3}, 
				config.get('writeModes.create')
			);

			expect(res)
			.to.deep.equal([]);

			res = await service.validate(
				{junk: 1}, 
				config.get('writeModes.create')
			);

			expect(res)
			.to.deep.equal([
				{path: 'name', message: 'can not be empty'},
				{path: 'title', message: 'can not be empty'}
			]);

			res = await service.validate(
				{junk: 1}, 
				config.get('writeModes.update')
			);

			expect(res)
			.to.deep.equal([]);

			res = await service.validate(
				{junk: 1, name: null, title: ''}, 
				config.get('writeModes.update')
			);

			expect(res)
			.to.deep.equal([
				{path: 'name', message: 'can not be empty'},
				{path: 'title', message: 'can not be empty'}
			]);
		});

		it('should error on create', async function(){
			let failed = false;

			try {
				await service.create({junk: true}, context);
			} catch(ex){
				expect(ex.code)
				.to.equal('BMOOR_CRUD_SERVICE_VALIDATE_CREATE');

				failed = true;
			}

			expect(failed)
			.to.equal(true);
		});

		it('should error on update', async function(){
			let failed = false;

			stubs.read = sinon.stub(service, 'read')
				.resolves({});

			try {
				await service.update(1, {junk: 1, name: null, title: ''}, context);
			} catch(ex){
				expect(ex.code)
				.to.equal('BMOOR_CRUD_SERVICE_VALIDATE_UPDATE');

				failed = true;
			}

			expect(failed)
			.to.equal(true);
		});
	});

	describe('with a cache', function(){
		let context = null;
		let service = null;

		beforeEach(async function(){
			context = new Context();

			stubs.execute = sinon.stub();

			connector.execute = async () => {
				return stubs.execute();
			};

			const model = new Model('model-1', nexus);

			await model.configure({
				source: 'test-1',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						read: true,
						create: true,
						update: true
					}
				}
			});

			service = new Crud(model);

			await service.configure();
		});

		describe('::create', function(){
			it('should cache the results of the create', async function(){
				stubs.execute.onCall(0)
				.resolves([{
					id: 123,
					name: 'foo-1'
				}]);

				context.sessionCache = {
					set: function(name, key, datum){
						expect(name)
						.to.equal('crud:model-1');

						expect(key)
						.to.equal(123);

						expect(datum)
						.to.deep.equal({
							id: 123,
							name: 'foo-1'
						});
					}
				};

				let res = await service.create({foo: 'bar'}, context);

				expect(res)
				.to.deep.equal({
					id: 123,
					name: 'foo-1'
				});
			});
		});

		describe('::read', function(){
			it('should cache the results of the read', async function(){
				stubs.execute.onCall(0)
				.resolves([{
					id: 123,
					name: 'foo-1'
				}]);

				context.sessionCache = {
					has: function(name, key){
						expect(name)
						.to.equal('crud:model-1');

						expect(key)
						.to.equal(234);
					},
					set: function(name, key, datum){
						expect(name)
						.to.equal('crud:model-1');

						expect(key)
						.to.equal(123);

						expect(datum)
						.to.deep.equal({
							id: 123,
							name: 'foo-1'
						});
					}
				};

				let res = await service.read(234, context);

				expect(res)
				.to.deep.equal({
					id: 123,
					name: 'foo-1'
				});
			});

			it('should respect a cache hit', async function(){
				context.sessionCache = {
					has: function(name, key){
						expect(name)
						.to.equal('crud:model-1');

						expect(key)
						.to.equal(234);

						return true;
					},
					get: function(name, key){
						expect(name)
						.to.equal('crud:model-1');

						expect(key)
						.to.equal(234);

						return {
							id: 123,
							name: 'foo-1'
						};
					}
				};

				let res = await service.read(234, context);

				expect(res)
				.to.deep.equal({
					id: 123,
					name: 'foo-1'
				});
			});
		});

		describe('::query', function(){
			it('should cache the results of the read', async function(){
				stubs.execute.onCall(0)
				.resolves([{
					id: 123,
					name: 'foo-1'
				}, {
					id: 234,
					name: 'foo-2'
				}]);

				stubs.set = sinon.stub()
					.returns(null);

				context.sessionCache = {
					set: stubs.set
				};

				let res = await service.query({}, context);

				expect(stubs.set.getCall(0).args)
				.to.deep.equal([
					'crud:model-1',
					123,
					{
						id: 123,
						name: 'foo-1'
					}
				]);

				expect(stubs.set.getCall(1).args)
				.to.deep.equal([
					'crud:model-1',
					234,
					{
						id: 234,
						name: 'foo-2'
					}
				]);

				expect(res)
				.to.deep.equal([{
					id: 123,
					name: 'foo-1'
				}, {
					id: 234,
					name: 'foo-2'
				}]);
			});
		});

		describe('::update', function(){
			it('should update the cache on update', async function(){
				stubs.execute.onCall(0)
				.resolves([{
					id: 345,
					name: 'foo-3'
				}]);

				context.sessionCache = {
					// these are for the read
					has: function(name, key){
						expect(name)
						.to.equal('crud:model-1');

						expect(key)
						.to.equal(234);

						return true;
					},
					get: function(name, key){
						expect(name)
						.to.equal('crud:model-1');

						expect(key)
						.to.equal(234);

						return {
							id: 123,
							name: 'foo-1'
						};
					},
					// this is the actual update
					set: function(name, key, datum){
						expect(name)
						.to.equal('crud:model-1');

						expect(key)
						.to.equal(234);

						expect(datum)
						.to.deep.equal({
							id: 345,
							name: 'foo-3'
						});
					}
				};

				let res = await service.update(234, {}, context);

				expect(res)
				.to.deep.equal({
					id: 345,
					name: 'foo-3'
				});
			});
		});
	});
});
