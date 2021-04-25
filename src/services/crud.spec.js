
const {expect} = require('chai');
const sinon = require('sinon');

const {Model} = require('../schema/model.js');
const {Crud} = require('./crud.js');
const {Context} = require('../server/context.js');

describe('src/services/crud.js', function(){
	let stubs = null;
	let context = null;
	let permissions = null;

	beforeEach(function(){
		stubs = {};

		permissions = {};

		context = new Context({method: 'get'});
		context.hasPermission =  (perm) => !!permissions[perm];
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => stub.restore());
	});

	describe('::clean', function(){
		// right now this is covered by forge's old code
	});

	describe('::buildCleaner', function(){
		let model = null;
		let service = null;

		beforeEach(async function(){
			model = new Model('model-1');

			await model.configure({
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
		let ctx = null;

		beforeEach(function(){
			ctx = new Context();
		});

		it('should basically work', async function(){
			const model = new Model('model-1');

			await model.configure({
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
						type: 'json'
					}
				}
			});

			const service = new Crud(model);

			await service.configure(
				{
					execute: function(request){
						expect(request.method).to.equal('create');
						expect(request.model).to.equal('model-1');
						expect(request.payload).to.deep.equal({
							name: 'name-1',
							title: 'title-1',
							json: '{"hello":"world"}'
						});

						return Promise.resolve([{
							id: 'something-1',
							value: 'v-1',
							json: '{"foo":"bar"}'
						}]);
					}
				}
			);

			return service.create({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk',
				json: {
					hello: 'world'
				}
			}, ctx)
			.then(res => {
				expect(res).to.deep.equal({
					id: 'something-1',
					json: {
						foo: 'bar'
					}
				});
			});
		});

		it('should not fail if a type field is blank', async function(){
			const model = new Model('model-1');

			await model.configure({
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
						type: 'json'
					}
				}
			});

			const service = new Crud(model);

			await service.configure({
				execute: function(request){
					expect(request.method).to.equal('create');
					expect(request.model).to.equal('model-1');
					expect(request.payload).to.deep.equal({
						name: 'name-1',
						title: 'title-1'
					});

					return Promise.resolve([{
						id: 'something-1',
						value: 'v-1'
					}]);
				}
			});

			return service.create({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk'
			}, ctx)
			.then(res => {
				expect(res).to.deep.equal({
					id: 'something-1'
				});
			});
		});
	});

	describe('::read', function(){
		it('should basically work', async function(){
			const model = new Model('model-1');

			await model.configure({
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
						type: 'json'
					}
				}
			});

			const service = new Crud(model);

			service.configure({
				execute: function(request){
					expect(request)
					.to.deep.equal({
						method: 'read',
						models: [{
							name: 'model-1',
							fields: [{
								path: 'id'
							}, {
								path: 'name'
							}, {
								path: 'title'
							}, {
								path: 'json'
							}],
							query: {
								id: 123
							},
							schema: 'model-1'
						}]
					});

					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
						json: '{"foo":"bar"}'
					}]);
				}
			});

			return service.read(123, {})
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
			const model = new Model('model-1');

			await model.configure({
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

			let response = null;
			const service = new Crud(model);

			await service.configure({
				execute: function(){
					return Promise.resolve([response]);
				}
			});

			//----------------
			response = {
				id: 'something-1',
				name: 'v-1',
				title: 't-1'
			};
			permissions = {};

			const res1 = await service.read(123, context);
			
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

			const res2 = await service.read(123, context);
			
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

			const res3 = await service.read(123, context);
			
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

			const res4 = await service.read(123, context);
			
			expect(res4)
			.to.deep.equal({
				id: 'something-4',
				title: 't-4'
			});
		});
	});

	describe('::readAll', function(){
		it('should basically work', async function(){
			const model = new Model('model-1');

			await model.configure({
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
						type: 'json'
					}
				}
			});

			const service = new Crud(model);

			await service.configure({
				execute: function(request){
					expect(request)
					.to.deep.equal({
						method: 'read',
						models: [{
							name: 'model-1',
							fields: [{
								path: 'id'
							}, {
								path: 'title'
							}, {
								path: 'json'
							}],
							query: undefined,
							schema: 'model-1'
						}]
					});

					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
						foo: 'bar'
					}]);
				}
			});

			return service.readAll()
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
			const model = new Model('model-1');

			await model.configure({
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
						type: 'json'
					}
				}
			});

			const service = new Crud(model);

			await service.configure({
				execute: function(request){
					expect(request)
					.to.deep.equal({
						method: 'read',
						models: [{
							name: 'model-1',
							fields: [{
								path: 'id'
							}, {
								path: 'title'
							}, {
								path: 'json'
							}],
							query: undefined,
							schema: 'model-1'
						}]
					});

					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
						foo: 'bar',
						json: '{"hello":"world"}'
					}]);
				}
			});

			service.readAll()
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
			const model = new Model('model-1');

			await model.configure({
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

			await service.configure({
				execute: function(){
					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
						foo: 'bar'
					}]);
				}
			});

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
			const model = new Model('model-1');

			await model.configure({
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

			await service.configure({
				execute: function(request){
					expect(request)
					.to.deep.equal({
						method: 'read',
						models: [{
							name: 'model-1',
							fields: [{
								path: 'id'
							}, {
								path: 'name'
							}, {
								path: 'title'
							}],
							query: {
								id: [1,2,3]
							},
							schema: 'model-1'
						}]
					});

					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
					}]);
				}
			});

			return service.readMany([1,2,3])
			.then(res => {
				expect(res).to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			});
		});

		it('should work with permissions', async function(){
			const model = new Model('model-1'); 

			await model.configure({
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

			await service.configure({
				execute: function(){
					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
						foo: 'bar'
					}]);
				}
			});

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
			const model = new Model('model-1');

			await model.configure({
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

			await service.configure({
				execute: function(request){
					expect(request)
					.to.deep.equal({
						method: 'read',
						models: [{
							name: 'model-1',
							fields: [{
								path: 'id'
							}, {
								path: 'name'
							}, {
								path: 'title'
							}],
							query: {
								name: 'test-1'
							},
							schema: 'model-1'
						}]
					});

					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
					}]);
				}
			});

			return service.query({
				params: {
					name: 'test-1'
				}
			}).then(res => {
				expect(res).to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			});
		});

		it('should pass through', async function(){
			const model = new Model('model-1');

			await model.configure({
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

			await service.configure({
				execute: function(request){
					expect(request)
					.to.deep.equal({
						method: 'read',
						models: [{
							name: 'model-1',
							fields: [{
								path: 'id'
							}, {
								path: 'name'
							}, {
								path: 'title'
							}],
							query: {
								id: 1,
								name: 'test-1',
								title: 'title-1'
							},
							schema: 'model-1'
						}]
					});

					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
					}]);
				}
			});

			return service.query({
				params: {
					id: 1,
					name: 'test-1',
					title: 'title-1'
				}
			}).then(res => {
				expect(res).to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);
			});
		});

		it('should work with permissions', async function(){
			const model = new Model('model-1');

			await model.configure({
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

			await service.configure({
				execute: function(){
					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
						foo: 'bar'
					}]);
				}
			});

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
			const model = new Model('model-1');

			await model.configure({
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
						type: 'json'
					}
				}
			});

			const service = new Crud(model);

			await service.configure({
				execute: function(request){
					expect(request.method).to.equal('update');
					expect(request.model).to.equal('model-1');
					expect(request.query).to.deep.equal({
						id: '1'
					});
					expect(request.payload)
					.to.deep.equal({
						name: 'test-1',
						title: 'title-1'
					});

					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
					}]);
				}
			});

			stubs.read = sinon.stub(service, 'read')
			.resolves({id:123});

			return service.update('1', {
				id: 1,
				name: 'test-1',
				title: 'title-1'
			}).then(res => {
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
			const model = new Model('model-1'); 

			await model.configure({
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
						type: 'json'
					}
				}
			});

			const service = new Crud(model);

			service.configure({
				execute: function(request){
					expect(request.method).to.equal('update');
					expect(request.model).to.equal('model-1');
					expect(request.query).to.deep.equal({
						id: '1'
					});
					expect(request.payload)
					.to.deep.equal({
						name: 'test-1',
						title: 'title-1',
						json: '{"hello":"world"}'
					});

					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
						json: '{"foo":"bar"}'
					}]);
				}
			});

			stubs.read = sinon.stub(service, 'read')
			.resolves({id:123});

			return service.update('1', {
				id: 1,
				name: 'test-1',
				title: 'title-1',
				json: {
					hello: 'world'
				}
			}).then(res => {
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
			const model = new Model('model-1');

			await model.configure({
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

			await service.configure({
				execute: function(request){
					expect(request.method).to.equal('delete');
					expect(request.model).to.equal('model-1');
					expect(request.query).to.deep.equal({
						id: '1'
					});

					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
					}]);
				}
			});

			stubs.read = sinon.stub(service, 'read')
			.resolves({id: 123});

			return service.delete('1')
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
			const model = new Model('model-1');

			await model.configure({
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

			await service.configure({
				execute: function(request){
					expect(request.method).to.equal('delete');
					expect(request.model).to.equal('model-1');
					expect(request.query).to.deep.equal({
						id: '1'
					});

					return Promise.resolve([{
						id: 'something-1',
						name: 'v-1',
						title: 't-1',
					}]);
				}
			});

			let wasSupered = false;

			service.decorate({
				superDelete: async function(id, ctx){
					expect(id).to.equal('1');

					wasSupered = true;

					return this.delete(id, ctx);
				}
			});

			stubs.read = sinon.stub(service, 'read')
			.resolves({id: 123});

			return service.superDelete('1')
			.then(res => {
				expect(res).to.deep.equal({
					id: 123
				});

				expect(stubs.read.getCall(0).args[0])
				.to.equal('1');
			});
		});
	});
});
