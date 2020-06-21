
const {expect} = require('chai');
const sinon = require('sinon');

const {Model} = require('../model.js');
const {Service} = require('../service.js');
const {Config} = require('bmoor/src/lib/config.js');
const {deflate, inflate} = require('./normalized.js');
const {Mapper} = require('bmoor-data/src/model/Mapper.js');

describe('src/synthetics/normalized', function(){
	let stubs = null;

	beforeEach(function(){
		stubs = {};
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => stub.restore());
	});
	
	describe('::deflate', function(){
		let mapper = null;
		let serviceRegistry = null;

		let class1 = null;
		let class2 = null;
		let class3 = null;
		let class4 = null;

		beforeEach(function(){
			const model1 = new Model('class-1', {
				fields: {
					'id': {
						key: true,
					},
					info: {
						index: true
					}
				}
			});

			class1 = new Service(model1);

			const model2 = new Model('class-2', {
				fields: {
					id: {
						key: true,
					},

					class1Id: {
						link: {
							name: 'class-1',
							field: 'id'
						}
					}
				}
			});

			class2 = new Service(model2);

			const model3 = new Model('class-3', {
				fields: {
					id: {
						key: true,
					},

					class2Id: {
						link: {
							name: 'class-2',
							field: 'id'
						}
					}
				}
			});

			class3 = new Service(model3);

			const model4 = new Model('class-4', {
				fields: {
					id: {
						key: true,
					},

					class1Id: {
						link: {
							name: 'class-1',
							field: 'id'
						}
					}
				}
			});

			class4 = new Service(model4);

			mapper = new Mapper();
			mapper.addModel(model3);
			mapper.addModel(model1);
			mapper.addModel(model2);
			mapper.addModel(model4);

			serviceRegistry = new Config();
			serviceRegistry.set(model1.name, class1);
			serviceRegistry.set(model2.name, class2);
			serviceRegistry.set(model3.name, class3);
			serviceRegistry.set(model4.name, class4);
		});

		it('should properly process a basic set of models', function(done){
			stubs.class1 = sinon.stub(class1, 'create')
			.resolves({id:123});

			stubs.class2 = sinon.stub(class2, 'create')
			.resolves({id:456});

			stubs.class3 = sinon.stub(class3, 'create')
			.resolves({id:789});

			stubs.class4 = sinon.stub(class4, 'create')
			.resolves({id:0});

			deflate({
				'class-1': [{
					$ref: 'foo-1'
				}],
				'class-2': [{
					$ref: 'bar-2',
					class1Id: 'foo-1'
				}],
				'class-3': [{
					class2Id: 'bar-2',
				}]
			}, mapper, serviceRegistry)
			.then(() => {
				expect(stubs.class1.getCall(0).args[0])
				.to.deep.equal({
					$ref: 'foo-1'
				});

				expect(stubs.class2.getCall(0).args[0])
				.to.deep.equal({
					$ref: 'bar-2',
					class1Id: 123
				});

				expect(stubs.class3.getCall(0).args[0])
				.to.deep.equal({
					class2Id: 456
				});

				done();
			}).catch(done);
		});

		it('should properly process a read (via read) with a set of models', function(done){
			stubs.class1 = sinon.stub(class1, 'read')
			.resolves({id:123});

			stubs.class2 = sinon.stub(class2, 'create')
			.resolves({id:456});

			stubs.class3 = sinon.stub(class3, 'create')
			.resolves({id:789});

			stubs.class4 = sinon.stub(class4, 'create')
			.resolves({id:0});

			deflate({
				'class-1': [{
					$type: 'read',
					$ref: 'foo-1',
					id: 'one'
				}],
				'class-2': [{
					$ref: 'bar-2',
					class1Id: 'foo-1'
				}],
				'class-3': [{
					class2Id: 'bar-2',
				}]
			}, mapper, serviceRegistry)
			.then(() => {
				expect(stubs.class1.getCall(0).args[0])
				.to.equal('one');

				expect(stubs.class2.getCall(0).args[0])
				.to.deep.equal({
					$ref: 'bar-2',
					class1Id: 123
				});

				expect(stubs.class3.getCall(0).args[0])
				.to.deep.equal({
					class2Id: 456
				});

				done();
			}).catch(done);
		});

		it('should properly process a read (via query) with a set of models', function(done){
			stubs.class1 = sinon.stub(class1, 'query')
			.resolves([{id:123}]);

			stubs.class2 = sinon.stub(class2, 'create')
			.resolves({id:456});

			stubs.class3 = sinon.stub(class3, 'create')
			.resolves({id:789});

			stubs.class4 = sinon.stub(class4, 'create')
			.resolves({id:0});

			deflate({
				'class-1': [{
					$type: 'read',
					$ref: 'foo-1',
					blah: 'one',
					info: 'eins'
				}],
				'class-2': [{
					$ref: 'bar-2',
					class1Id: 'foo-1'
				}],
				'class-3': [{
					class2Id: 'bar-2',
				}]
			}, mapper, serviceRegistry)
			.then(() => {
				expect(stubs.class1.getCall(0).args[0])
				.to.deep.equal({
					info: 'eins'
				});

				expect(stubs.class2.getCall(0).args[0])
				.to.deep.equal({
					$ref: 'bar-2',
					class1Id: 123
				});

				expect(stubs.class3.getCall(0).args[0])
				.to.deep.equal({
					class2Id: 456
				});

				done();
			}).catch(done);
		});

		it('should properly process an update (via read) with a set of models', function(done){
			stubs.class1Read = sinon.stub(class1, 'read')
			.resolves({id:123});

			stubs.class1Update = sinon.stub(class1, 'update')
			.resolves({id:123});

			stubs.class2 = sinon.stub(class2, 'create')
			.resolves({id:456});

			stubs.class3 = sinon.stub(class3, 'create')
			.resolves({id:789});

			stubs.class4 = sinon.stub(class4, 'create')
			.resolves({id:0});

			deflate({
				'class-1': [{
					$type: 'update',
					$ref: 'foo-1',
					id: 'one'
				}],
				'class-2': [{
					$ref: 'bar-2',
					class1Id: 'foo-1'
				}],
				'class-3': [{
					class2Id: 'bar-2',
				}]
			}, mapper, serviceRegistry)
			.then(() => {
				expect(stubs.class1Read.getCall(0).args[0])
				.to.equal('one');

				expect(stubs.class1Update.getCall(0).args[0])
				.to.equal(123);

				expect(stubs.class1Update.getCall(0).args[1])
				.to.deep.equal({
					$type: 'update',
					$ref: 'foo-1',
					id: 'one'
				});

				expect(stubs.class2.getCall(0).args[0])
				.to.deep.equal({
					$ref: 'bar-2',
					class1Id: 123
				});

				expect(stubs.class3.getCall(0).args[0])
				.to.deep.equal({
					class2Id: 456
				});

				done();
			}).catch(done);
		});

		it('should properly process an update (via query) with a set of models', function(done){
			stubs.class1Read = sinon.stub(class1, 'query')
			.resolves([{id:123}]);

			stubs.class1Update = sinon.stub(class1, 'update')
			.resolves({id:123});

			stubs.class2 = sinon.stub(class2, 'create')
			.resolves({id:456});

			stubs.class3 = sinon.stub(class3, 'create')
			.resolves({id:789});

			stubs.class4 = sinon.stub(class4, 'create')
			.resolves({id:0});

			deflate({
				'class-1': [{
					$type: 'update',
					$ref: 'foo-1',
					id: {
						info: 'one'
					}
				}],
				'class-2': [{
					$ref: 'bar-2',
					class1Id: 'foo-1'
				}],
				'class-3': [{
					class2Id: 'bar-2',
				}]
			}, mapper, serviceRegistry)
			.then(() => {
				expect(stubs.class1Read.getCall(0).args[0])
				.to.deep.equal({info:'one'});

				expect(stubs.class1Update.getCall(0).args[0])
				.to.equal(123);

				expect(stubs.class1Update.getCall(0).args[1])
				.to.deep.equal({
					$type: 'update',
					$ref: 'foo-1',
					id: {
						info: 'one'
					}
				});

				expect(stubs.class2.getCall(0).args[0])
				.to.deep.equal({
					$ref: 'bar-2',
					class1Id: 123
				});

				expect(stubs.class3.getCall(0).args[0])
				.to.deep.equal({
					class2Id: 456
				});

				done();
			}).catch(done);
		});
	});

	describe('::inflate', function(){
		let mapper = null;
		let serviceRegistry = null;

		let class1 = null;
		let class2 = null;
		let class3 = null;
		let class4 = null;

		beforeEach(function(){
			const model1 = new Model('class-1', {
				fields: {
					'id': {
						key: true,
					},
					info: {
						index: true
					}
				}
			});

			class1 = new Service(model1);

			const model2 = new Model('class-2', {
				fields: {
					id: {
						key: true,
					},
					class1Id: {
						link: {
							name: 'class-1',
							field: 'id'
						}
					}
				}
			});

			class2 = new Service(model2);

			const model3 = new Model('class-3', {
				fields: {
					id: {
						key: true,
					},
					class2Id: {
						link: {
							name: 'class-2',
							field: 'id'
						}
					}
				}
			});

			class3 = new Service(model3);

			const model4 = new Model('class-4', {
				fields: {
					id: {
						key: true,
					},
					class1Id: {
						link: {
							name: 'class-1',
							field: 'id'
						}
					}
				}
			});

			class4 = new Service(model4);

			mapper = new Mapper();
			mapper.addModel(model3);
			mapper.addModel(model1);
			mapper.addModel(model2);
			mapper.addModel(model4);

			serviceRegistry = new Config();
			serviceRegistry.set(model1.name, class1);
			serviceRegistry.set(model2.name, class2);
			serviceRegistry.set(model3.name, class3);
			serviceRegistry.set(model4.name, class4);
		});

		describe('class1', function(){
			it('should properly with a single key', function(done){
				stubs.class1 = sinon.stub(class1, 'read')
				.resolves({
					id:123,
					hello: 'world'
				});

				inflate('class-1', {keys:['key-1']}, mapper, serviceRegistry, {})
				.then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.equal('key-1');

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-0',
							$type: 'create-or-update',
							hello: 'world'
						}]
					});

					done();
				}).catch(done);
			});

			it('should properly with multiple keys', function(done){
				stubs.class1 = sinon.stub(class1, 'read');
				stubs.class1.onCall(0).resolves({
					id: 123,
					foo: 'bar'
				});
				stubs.class1.onCall(1).resolves({
					id: 456,
					foo: 'bar2'
				});
				
				inflate('class-1', {keys:['key-1', 'key-2']}, mapper, serviceRegistry, {})
				.then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.equal('key-1');

					expect(stubs.class1.getCall(1).args[0])
					.to.equal('key-2');

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-0',
							$type: 'create-or-update',
							foo: 'bar'
						},{
							$ref: 'ref-1',
							$type: 'create-or-update',
							foo: 'bar2'
						}]
					});

					done();
				}).catch(done);
			});
		});

		describe('class3', function(){
			it('should properly with a single key', function(done){
				stubs.class1 = sinon.stub(class1, 'query')
				.resolves([{
					n: 1,
					id:123
				}]);

				stubs.class2 = sinon.stub(class2, 'query')
				.resolves([{
					n: 2,
					id:123,
					class1Id: 'key-1-1'
				}]);

				stubs.class3 = sinon.stub(class3, 'read')
				.resolves({
					n: 3,
					id:123,
					class2Id: 'key-2-1'
				});

				inflate('class-3', {keys:['key-1']}, mapper, serviceRegistry, {})
				.then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.deep.equal({id:'key-1-1'});

					expect(stubs.class2.getCall(0).args[0])
					.to.deep.equal({id:'key-2-1'});

					expect(stubs.class3.getCall(0).args[0])
					.to.equal('key-1');

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-3',
							$type: 'create-or-update',
							n: 1
						}],
						'class-2': [{
							$ref: 'ref-1',
							$type: 'create-or-update',
							n: 2,
							class1Id: 'ref-3'
						}],
						'class-3': [{
							$ref: 'ref-0',
							$type: 'create-or-update',
							n: 3,
							class2Id: 'ref-1'
						}]
					});

					done();
				}).catch(done);
			});

			it('should properly with multiple keys', function(done){
				stubs.class1 = sinon.stub(class1, 'query');
				stubs.class1.onCall(0).resolves([{
					n: 1,
					id:123
				}]);

				stubs.class2 = sinon.stub(class2, 'query');
				stubs.class2.onCall(0).resolves([{
					n: 2,
					id:123,
					class1Id: 'key-1-1'
				}]);
				stubs.class2.onCall(1).resolves([{
					n: 3,
					id:234,
					class1Id: 'key-1-1'
				}]);

				stubs.class3 = sinon.stub(class3, 'read');
				stubs.class3.onCall(0).resolves({
					n: 4,
					id:456,
					class2Id: 'key-2-1'
				});
				stubs.class3.onCall(1).resolves({
					n: 5,
					id:567,
					class2Id: null
				});
				stubs.class3.onCall(2).resolves({
					n: 6,
					id:678,
					class2Id: 'key-2-2'
				});

				inflate('class-3', {keys:['key-1', 'key-2', 'key-3']}, mapper, serviceRegistry, {})
				.then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.deep.equal({id:'key-1-1'});

					expect(stubs.class2.getCall(0).args[0])
					.to.deep.equal({id:'key-2-1'});

					expect(stubs.class2.getCall(1).args[0])
					.to.deep.equal({id:'key-2-2'});

					expect(stubs.class3.getCall(0).args[0])
					.to.equal('key-1');

					expect(stubs.class3.getCall(1).args[0])
					.to.equal('key-2');

					expect(stubs.class3.getCall(2).args[0])
					.to.equal('key-3');

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-6',
							$type: 'create-or-update',
							n: 1
						}],
						'class-2': [{
							$ref: 'ref-1',
							$type: 'create-or-update',
							n: 2,
							class1Id: 'ref-6'
						}, {
							$ref: 'ref-4',
							$type: 'create-or-update',
							n: 3,
							class1Id: 'ref-6'
						}],
						'class-3': [{
							$ref: 'ref-0',
							$type: 'create-or-update',
							n: 4,
							class2Id: 'ref-1'
						},{
							$ref: 'ref-2',
							$type: 'create-or-update',
							n: 5,
							class2Id: null
						},{
							$ref: 'ref-3',
							$type: 'create-or-update',
							n: 6,
							class2Id: 'ref-4'
						}]
					});

					done();
				}).catch(done);
			});
		});

		describe('class4', function(){
			it('should properly with a single key', function(done){
				stubs.class1 = sinon.stub(class1, 'query')
				.resolves([{
					n: 1,
					id:123
				}]);

				stubs.class4 = sinon.stub(class4, 'read')
				.resolves({
					n: 2,
					id:123,
					class1Id: 'key-1-1'
				});

				inflate('class-4', {keys:['key-1']}, mapper, serviceRegistry, {})
				.then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.deep.equal({id:'key-1-1'});

					expect(stubs.class4.getCall(0).args[0])
					.to.equal('key-1');

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-1',
							$type: 'create-or-update',
							n: 1
						}],
						'class-4': [{
							$ref: 'ref-0',
							$type: 'create-or-update',
							n: 2,
							class1Id: 'ref-1'
						}]
					});

					done();
				}).catch(done);
			});

			it('should properly with a dual key', function(done){
				stubs.class1 = sinon.stub(class1, 'query');
				stubs.class1.onCall(0).resolves([{
					n: 1,
					id:123
				}]);

				stubs.class4 = sinon.stub(class4, 'read');
				stubs.class4.onCall(0).resolves({
					n: 2,
					id:123,
					class1Id: 'key-1-1'
				});

				stubs.class4.onCall(1).resolves({
					n: 3,
					id:234,
					class1Id: 'key-1-1'
				});

				inflate('class-4', {keys:['key-1', 'key-2']}, mapper, serviceRegistry, {})
				.then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.deep.equal({id:'key-1-1'});

					expect(stubs.class4.getCall(0).args[0])
					.to.equal('key-1');

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-1',
							$type: 'create-or-update',
							n: 1
						}],
						'class-4': [{
							$ref: 'ref-0',
							$type: 'create-or-update',
							n: 2,
							class1Id: 'ref-1'
						}, {
							$ref: 'ref-2',
							$type: 'create-or-update',
							n: 3,
							class1Id: 'ref-1'
						}]
					});

					done();
				}).catch(done);
			});
		});

		describe('class3 - class4 joined into', function(){
			it('should properly with a single key', function(done){
				stubs.class1 = sinon.stub(class1, 'query')
				.resolves([{
					n: 1,
					id: 123
				}]);

				stubs.class2 = sinon.stub(class2, 'query')
				.resolves([{
					n: 2,
					id: 234,
					class1Id: 123
				}]);

				stubs.class3 = sinon.stub(class3, 'read')
				.resolves({
					n: 3,
					id: 345,
					class2Id: 234
				});

				stubs.class4 = sinon.stub(class4, 'query')
				.resolves([{
					n: 4,
					id: 456,
					class1Id: 123
				}]);

				inflate('class-3', {keys:[345], join:['class-4']}, mapper, serviceRegistry, {})
				.then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.deep.equal({id:123});

					expect(stubs.class2.getCall(0).args[0])
					.to.deep.equal({id:234});

					expect(stubs.class3.getCall(0).args[0])
					.to.equal(345);

					expect(stubs.class4.getCall(0).args[0])
					.to.deep.equal({class1Id: 123});

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-2',
							$type: 'create-or-update',
							n: 1
						}],
						'class-2': [{
							$ref: 'ref-1',
							$type: 'create-or-update',
							n: 2,
							class1Id: 'ref-2'
						}],
						'class-3': [{
							$ref: 'ref-0',
							$type: 'create-or-update',
							n: 3,
							class2Id: 'ref-1'
						}],
						'class-4': [{
							$ref: 'ref-3',
							$type: 'create-or-update',
							n: 4,
							class1Id: 'ref-2'
						}]
					});

					done();
				}).catch(done);
			});

			it('should properly allow the stubbing of a table', function(done){
				stubs.class1 = sinon.stub(class1, 'query')
				.resolves([{
					n: 1,
					id: 123
				}]);

				stubs.class2 = sinon.stub(class2, 'query')
				.resolves([{
					n: 2,
					id: 234,
					class1Id: 123
				}]);

				stubs.class3 = sinon.stub(class3, 'read')
				.resolves({
					n: 3,
					id: 345,
					class2Id: 234
				});

				stubs.class4 = sinon.stub(class4, 'query')
				.resolves([{
					n: 4,
					id: 456,
					class1Id: 123
				}]);

				inflate('class-3', {keys:[345], stub:['class-2']}, mapper, serviceRegistry, {})
				.then(instructions => {
					expect(stubs.class1.getCall(0))
					.to.equal(null);

					expect(stubs.class2.getCall(0).args[0])
					.to.deep.equal({id:234});

					expect(stubs.class3.getCall(0).args[0])
					.to.equal(345);

					expect(stubs.class4.getCall(0))
					.to.equal(null);

					expect(instructions)
					.to.deep.equal({
						'class-2': [{
							$ref: 'ref-1',
							$type: 'read',
							n: 2,
							class1Id: 123
						}],
						'class-3': [{
							$ref: 'ref-0',
							$type: 'create-or-update',
							n: 3,
							class2Id: 'ref-1'
						}]
					});

					done();
				}).catch(done);
			});
		});
	});
	
	describe('pivot time', function(){
		let mapper = null;
		let serviceRegistry = null;

		let class1 = null;
		let class2 = null;
		let class3 = null;
		let class4 = null;
		let class5 = null;

		beforeEach(function(){
			const model1 = new Model('class-1', {
				fields: {
					'id': {
						key: true,
					},
					info: {
						index: true
					}
				}
			});

			class1 = new Service(model1);

			const model2 = new Model('class-2', {
				fields: {
					id: {
						key: true,
					},
					class1Id: {
						link: {
							name: 'class-1',
							field: 'name'
						}
					}
				}
			});

			class2 = new Service(model2);

			const model3 = new Model('class-3', {
				fields: {
					id: {
						key: true,
					}
				}
			});

			class3 = new Service(model3);

			const model4 = new Model('class-4', {
				fields: {
					id: {
						key: true,
					},
					class3Id: {
						link: {
							name: 'class-3',
							field: 'name'
						}
					}
				}
			});

			class4 = new Service(model4);

			const model5 = new Model('class-5', {
				fields: {
					id: {
						key: true,
					},
					class2Id: {
						link: {
							name: 'class-2',
							field: 'name'
						}
					},
					class4Id: {
						link: {
							name: 'class-4',
							field: 'name'
						}
					}
				}
			});

			class5 = new Service(model5);

			mapper = new Mapper();
			mapper.addModel(model1);
			mapper.addModel(model2);
			mapper.addModel(model3);
			mapper.addModel(model4);
			mapper.addModel(model5);

			serviceRegistry = new Config();
			serviceRegistry.set(model1.name, class1);
			serviceRegistry.set(model2.name, class2);
			serviceRegistry.set(model3.name, class3);
			serviceRegistry.set(model4.name, class4);
			serviceRegistry.set(model5.name, class5);
		});

		describe('::inflate', function(){
			it('should work from class 1', function(done){
				stubs.class1 = sinon.stub(class1, 'read')
				.resolves({
					n: 1,
					id: 123
				});

				stubs.class2 = sinon.stub(class2, 'query')
				.resolves([{
					n: 2,
					id: 234,
					class1Id: 123
				}]);

				stubs.class3 = sinon.stub(class3, 'query')
				.resolves([{
					n: 3,
					id: 345
				}]);

				stubs.class4 = sinon.stub(class4, 'query')
				.resolves([{
					n: 4,
					id: 456,
					class3Id: 345
				}]);

				stubs.class5 = sinon.stub(class5, 'query');
				stubs.class5.onCall(0).resolves([{
					n: 5,
					id: 567,
					class2Id: 234,
					class4Id: 456
				}]);
				stubs.class5.onCall(1).resolves([{
					n: 5,
					id: 567,
					class2Id: 234,
					class4Id: 456
				}]);

				inflate('class-1', {keys:[123], join:['class-2', 'class-5']}, mapper, serviceRegistry, {})
				.then(instructions => {

					expect(stubs.class1.getCall(0).args[0])
					.to.equal(123);

					expect(stubs.class2.getCall(0).args[0])
					.to.deep.equal({class1Id: 123});

					expect(stubs.class3.getCall(0).args[0])
					.to.deep.equal({name:345});

					expect(stubs.class4.getCall(0).args[0])
					.to.deep.equal({name:456});

					expect(stubs.class5.getCall(0).args[0])
					.to.deep.equal({class2Id: 234});

					expect(stubs.class5.getCall(1).args[0])
					.to.deep.equal({class4Id: 456});

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-0',
							$type: 'create-or-update',
							n: 1
						}],
						'class-2': [{
							$ref: 'ref-1',
							$type: 'create-or-update',
							n: 2,
							class1Id: 'ref-0'
						}],
						'class-3': [{
							$ref: 'ref-4',
							$type: 'create-or-update',
							n: 3
						}],
						'class-4': [{
							$ref: 'ref-3',
							$type: 'create-or-update',
							n: 4,
							class3Id: 'ref-4'
						}],
						'class-5': [{
							$ref: 'ref-2',
							$type: 'create-or-update',
							n: 5,
							class2Id: 'ref-1',
							class4Id: 'ref-3'
						}]
					});

					done();
				}).catch(done);
			});
		});
	});
});
