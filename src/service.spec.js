
const {expect} = require('chai');
const sinon = require('sinon');

const {Model} = require('./Model.js');
const {Service} = require('./Service.js');

describe('src/service.js', function(){
	let stubs = null;

	beforeEach(function(){
		stubs = {};
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => stub.restore());
	});

	describe('::create', function(){
		it('should basically work', function(done){
			const model = new Model('model-1', {
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

			const service = new Service(
				model,
				{
					prepare: function(request){
						expect(request.method).to.equal('create');
						expect(request.model).to.equal(model);
						expect(request.delta).to.deep.equal({
							name: 'name-1',
							title: 'title-1'
						});

						return Promise.resolve('foo-bar');
					},
					execute: function(prepared){
						expect(prepared).to.equal('foo-bar');

						return Promise.resolve([{
							id: 'something-1',
							value: 'v-1'
						}]);
					}
				}
			);

			service.create({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk'
			}).then(res => {
				expect(res).to.deep.equal({
					id: 'something-1',
					value: 'v-1'
				});

				done();
			}).catch(done);
		});
	});

	describe('::read', function(){
		it('should basically work', function(done){
			const model = new Model('model-1', {
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

			const service = new Service(
				model,
				{
					prepare: function(request){
						expect(request.method).to.equal('read');
						expect(request.model).to.equal(model);
						expect(request.context).to.deep.equal({
							id: 123
						});

						return Promise.resolve('foo-bar');
					},
					execute: function(prepared){
						expect(prepared).to.equal('foo-bar');

						return Promise.resolve([{
							id: 'something-1',
							name: 'v-1',
							title: 't-1',
						}]);
					}
				}
			);

			service.read(123)
			.then(res => {
				expect(res).to.deep.equal({
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				});

				done();
			}).catch(done);
		});
	});

	describe('::readAll', function(){
		it('should basically work', function(done){
			const model = new Model('model-1', {
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

			const service = new Service(
				model,
				{
					prepare: function(request){
						expect(request.method).to.equal('read');
						expect(request.model).to.equal(model);
						expect(request.context).to.equal(null);

						return Promise.resolve('foo-bar');
					},
					execute: function(prepared){
						expect(prepared).to.equal('foo-bar');

						return Promise.resolve([{
							id: 'something-1',
							name: 'v-1',
							title: 't-1',
						}]);
					}
				}
			);

			service.readAll()
			.then(res => {
				expect(res).to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);

				done();
			}).catch(done);
		});
	});

	describe('::readMany', function(){
		it('should basically work', function(done){
			const model = new Model('model-1', {
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

			const service = new Service(
				model,
				{
					prepare: function(request){
						expect(request.method).to.equal('read');
						expect(request.model).to.equal(model);
						expect(request.context).to.deep.equal({id: [1,2,3]});

						return Promise.resolve('foo-bar');
					},
					execute: function(prepared){
						expect(prepared).to.equal('foo-bar');

						return Promise.resolve([{
							id: 'something-1',
							name: 'v-1',
							title: 't-1',
						}]);
					}
				}
			);

			service.readMany([1,2,3])
			.then(res => {
				expect(res).to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);

				done();
			}).catch(done);
		});
	});

	describe('::query', function(){
		it('should basically work', function(done){
			const model = new Model('model-1', {
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

			const service = new Service(
				model,
				{
					prepare: function(request){
						expect(request.method).to.equal('read');
						expect(request.model).to.equal(model);
						expect(request.context).to.deep.equal({
							name: 'test-1'
						});

						return Promise.resolve('foo-bar');
					},
					execute: function(prepared){
						expect(prepared).to.equal('foo-bar');

						return Promise.resolve([{
							id: 'something-1',
							name: 'v-1',
							title: 't-1',
						}]);
					}
				}
			);

			service.query({
				id: 1,
				name: 'test-1',
				title: 'title-1'
			}).then(res => {
				expect(res).to.deep.equal([{
					id: 'something-1',
					name: 'v-1',
					title: 't-1',
				}]);

				done();
			}).catch(done);
		});
	});

	describe('::update', function(){
		it('should basically work', function(done){
			const model = new Model('model-1', {
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

			const service = new Service(
				model,
				{
					prepare: function(request){
						expect(request.method).to.equal('update');
						expect(request.model).to.equal(model);
						expect(request.context).to.deep.equal({
							id: '1'
						});

						return Promise.resolve('foo-bar');
					},
					execute: function(prepared){
						expect(prepared).to.equal('foo-bar');

						return Promise.resolve([{
							id: 'something-1',
							name: 'v-1',
							title: 't-1',
						}]);
					}
				}
			);

			stubs.read = sinon.stub(service, 'read')
			.resolves({id:123});

			service.update('1', {
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

				done();
			}).catch(done);
		});
	});

	describe('::delete', function(){
		it('should basically work', function(done){
			const model = new Model('model-1', {
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

			const service = new Service(
				model,
				{
					prepare: function(request){
						expect(request.method).to.equal('delete');
						expect(request.model).to.equal(model);
						expect(request.context).to.deep.equal({
							id: '1'
						});

						return Promise.resolve('foo-bar');
					},
					execute: function(prepared){
						expect(prepared).to.equal('foo-bar');

						return Promise.resolve([{
							id: 'something-1',
							name: 'v-1',
							title: 't-1',
						}]);
					}
				}
			);

			stubs.read = sinon.stub(service, 'read')
			.resolves({id: 123});

			service.delete('1')
			.then(res => {
				expect(res).to.deep.equal({
					id: 123
				});

				expect(stubs.read.getCall(0).args[0])
				.to.equal('1');

				done();
			}).catch(done);
		});
	});

	describe('::decorate', function(){
		it('should basically work', async function(){
			const model = new Model('model-1', {
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

			const service = new Service(
				model,
				{
					prepare: function(request){
						expect(request.method).to.equal('delete');
						expect(request.model).to.equal(model);
						expect(request.context).to.deep.equal({
							id: '1'
						});

						return Promise.resolve('foo-bar');
					},
					execute: function(prepared){
						expect(prepared).to.equal('foo-bar');

						return Promise.resolve([{
							id: 'something-1',
							name: 'v-1',
							title: 't-1',
						}]);
					}
				}
			);

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

			return await service.superDelete('1')
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
