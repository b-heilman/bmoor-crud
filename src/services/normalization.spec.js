
const {expect} = require('chai');
const sinon = require('sinon');

const {Nexus} = require('../env/nexus.js');
const {Context} = require('../server/context.js');
const {deflate, inflate} = require('./normalization.js');

describe('src/service/normalization', function(){
	let ctx = null;
	let stubs = null;
	let nexus = null;

	beforeEach(async function(){
		ctx = new Context();
		stubs = {
			execute: sinon.stub()
		};
		nexus = new Nexus();

		const connector = {
			execute: async (...args) => stubs.execute(...args)
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
	
	describe('::deflate', function(){
		let class1 = null;
		let class2 = null;
		let class3 = null;
		let class4 = null;

		beforeEach(async function(){
			nexus.configureModel('class-1', {
				source: 'test-1',
				fields: {
					'id': {
						key: true,
					},
					info: {
						index: true
					}
				}
			});

			class1 = await nexus.configureCrud('class-1');

			nexus.configureModel('class-2', {
				source: 'test-1',
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

			class2 = await nexus.configureCrud('class-2');

			nexus.configureModel('class-3', {
				source: 'test-1',
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

			class3 = await nexus.configureCrud('class-3');

			nexus.configureModel('class-4', {
				source: 'test-1',
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

			class4 = await nexus.configureCrud('class-4');
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
					$ref: 'foo-1',
					foo: 'bar'
				}],
				'class-2': [{
					$ref: 'bar-2',
					class1Id: 'foo-1'
				}],
				'class-3': [{
					class2Id: 'bar-2',
				}]
			}, nexus, ctx)
			.then(() => {
				expect(stubs.class1.getCall(0).args[0])
				.to.deep.equal({
					foo: 'bar'
				});

				expect(stubs.class2.getCall(0).args[0])
				.to.deep.equal({
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
					$ref: 'foo-1',
					$type: 'read',
					id: 'one'
				}],
				'class-2': [{
					$ref: 'bar-2',
					class1Id: 'foo-1'
				}],
				'class-3': [{
					$ref: 'bar-2',
					class2Id: 'bar-2',
				}]
			}, nexus, ctx)
			.then(() => {
				expect(stubs.class1.getCall(0).args[0])
				.to.equal('one');

				expect(stubs.class2.getCall(0).args[0])
				.to.deep.equal({
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
			}, nexus, ctx)
			.then(res => {
				expect(stubs.class1.getCall(0).args[0])
				.to.deep.equal({
					info: 'eins'
				});

				expect(stubs.class2.getCall(0).args[0])
				.to.deep.equal({
					class1Id: 123
				});

				expect(stubs.class3.getCall(0).args[0])
				.to.deep.equal({
					class2Id: 456
				});

				expect(res)
				.to.deep.equal([{
					model: 'class-1',
					action: 'read',
					datum: {
						id: 123
					}
				}, {
					model: 'class-2',
					action: 'create',
					datum: {
						id: 456
					}
				}, {
					model: 'class-3',
					action: 'create',
					datum: {
						id: 789
					}
				}]);

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
			}, nexus, ctx)
			.then(() => {
				expect(stubs.class1Read.getCall(0).args[0])
				.to.equal('one');

				expect(stubs.class1Update.getCall(0).args[0])
				.to.equal(123);

				expect(stubs.class1Update.getCall(0).args[1])
				.to.deep.equal({
					id: 'one'
				});

				expect(stubs.class2.getCall(0).args[0])
				.to.deep.equal({
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
			stubs.class1Query = sinon.stub(class1, 'query')
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
					info: 'one'
				}],
				'class-2': [{
					$ref: 'bar-2',
					class1Id: 'foo-1'
				}],
				'class-3': [{
					class2Id: 'bar-2',
				}]
			}, nexus, ctx)
			.then(() => {
				expect(stubs.class1Query.getCall(0).args[0])
				.to.deep.equal({info:'one'});

				expect(stubs.class1Update.getCall(0).args[0])
				.to.equal(123);

				expect(stubs.class1Update.getCall(0).args[1])
				.to.deep.equal({
					info: 'one'
				});

				expect(stubs.class2.getCall(0).args[0])
				.to.deep.equal({
					class1Id: 123
				});

				expect(stubs.class3.getCall(0).args[0])
				.to.deep.equal({
					class2Id: 456
				});

				done();
			}).catch(done);
		});

		it('should properly process parallel requests', async function(){
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

			const before = deflate({
				'class-2': [{
					$ref: 'bar-2',
					class1Id: 'foo-1'
				}],
				'class-3': [{
					class2Id: 'bar-2',
				}]
			}, nexus, ctx);

			await deflate({
				'class-1': [{
					$type: 'update',
					$ref: 'foo-1',
					info: 'one'
				}]
			}, nexus, ctx);

			await before;

			expect(stubs.class1Read.getCall(0).args[0])
			.to.deep.equal({info:'one'});

			expect(stubs.class1Update.getCall(0).args[0])
			.to.equal(123);

			expect(stubs.class1Update.getCall(0).args[1])
			.to.deep.equal({
				info: 'one'
			});

			expect(stubs.class2.getCall(0).args[0])
			.to.deep.equal({
				class1Id: 123
			});

			expect(stubs.class3.getCall(0).args[0])
			.to.deep.equal({
				class2Id: 456
			});
		});
	});

	describe('::inflate', function(){
		let class1 = null;
		let class2 = null;
		let class3 = null;
		let class4 = null;

		beforeEach(async function(){
			await nexus.configureModel('class-1', {
				source: 'test-1',
				fields: {
					'id': {
						key: true,
					},
					info: {
						index: true
					}
				}
			});

			class1 = await nexus.configureCrud('class-1');

			await nexus.configureModel('class-2', {
				source: 'test-1',
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

			class2 = await nexus.configureCrud('class-2');

			await nexus.configureModel('class-3', {
				source: 'test-1',
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

			class3 = await nexus.configureCrud('class-3');

			await nexus.configureModel('class-4', {
				source: 'test-1',
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

			class4 = await nexus.configureCrud('class-4');
		});

		describe('class1', function(){
			it('should properly with a single key', function(done){
				stubs.class1 = sinon.stub(class1, 'read')
				.resolves({
					id:123,
					hello: 'world'
				});

				inflate(
					'class-1', 
					{keys:['key-1']}, 
					nexus, 
					{}
				).then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.equal('key-1');

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-0',
							$type: 'update-create',
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
				
				inflate(
					'class-1', 
					{keys:['key-1', 'key-2']}, 
					nexus, 
					{}
				).then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.equal('key-1');

					expect(stubs.class1.getCall(1).args[0])
					.to.equal('key-2');

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-0',
							$type: 'update-create',
							foo: 'bar'
						},{
							$ref: 'ref-1',
							$type: 'update-create',
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

				inflate('class-3', 
					{keys:['key-1']},
					nexus, 
					{}
				).then(instructions => {
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
							$type: 'update-create',
							n: 1
						}],
						'class-2': [{
							$ref: 'ref-1',
							$type: 'update-create',
							n: 2,
							class1Id: 'ref-3'
						}],
						'class-3': [{
							$ref: 'ref-0',
							$type: 'update-create',
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

				inflate(
					'class-3', 
					{keys:['key-1', 'key-2', 'key-3']}, 
					nexus, 
					{}
				).then(instructions => {
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
							$type: 'update-create',
							n: 1
						}],
						'class-2': [{
							$ref: 'ref-1',
							$type: 'update-create',
							n: 2,
							class1Id: 'ref-6'
						}, {
							$ref: 'ref-4',
							$type: 'update-create',
							n: 3,
							class1Id: 'ref-6'
						}],
						'class-3': [{
							$ref: 'ref-0',
							$type: 'update-create',
							n: 4,
							class2Id: 'ref-1'
						},{
							$ref: 'ref-2',
							$type: 'update-create',
							n: 5,
							class2Id: null
						},{
							$ref: 'ref-3',
							$type: 'update-create',
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

				inflate(
					'class-4', 
					{keys:['key-1']},
					nexus,
					{}
				).then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.deep.equal({id:'key-1-1'});

					expect(stubs.class4.getCall(0).args[0])
					.to.equal('key-1');

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-1',
							$type: 'update-create',
							n: 1
						}],
						'class-4': [{
							$ref: 'ref-0',
							$type: 'update-create',
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

				inflate(
					'class-4', 
					{keys:['key-1', 'key-2']}, 
					nexus, 
					{}
				).then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.deep.equal({id:'key-1-1'});

					expect(stubs.class4.getCall(0).args[0])
					.to.equal('key-1');

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-1',
							$type: 'update-create',
							n: 1
						}],
						'class-4': [{
							$ref: 'ref-0',
							$type: 'update-create',
							n: 2,
							class1Id: 'ref-1'
						}, {
							$ref: 'ref-2',
							$type: 'update-create',
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

				inflate(
					'class-3', 
					{
						keys: [345], 
						join: {
							'class-1': ['class-4']
						}
					}, 
					nexus, 
					{}
				).then(instructions => {
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
							$type: 'update-create',
							n: 1
						}],
						'class-2': [{
							$ref: 'ref-1',
							$type: 'update-create',
							n: 2,
							class1Id: 'ref-2'
						}],
						'class-3': [{
							$ref: 'ref-0',
							$type: 'update-create',
							n: 3,
							class2Id: 'ref-1'
						}],
						'class-4': [{
							$ref: 'ref-3',
							$type: 'update-create',
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

				inflate(
					'class-3', 
					{
						keys: [345], 
						stub: ['class-2']
					}, 
					nexus, 
					{}
				).then(instructions => {
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
							$type: 'update-create',
							n: 3,
							class2Id: 'ref-1'
						}]
					});

					done();
				}).catch(done);
			});

			it('should properly allow the ensuring of a table', function(done){
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

				inflate(
					'class-3', 
					{
						keys: [345], 
						ensure: ['class-2'],
						stub: ['class-1']
					}, 
					nexus, 
					{}
				).then(instructions => {
					expect(stubs.class1.getCall(0).args[0])
					.to.deep.equal({id:123});

					expect(stubs.class2.getCall(0).args[0])
					.to.deep.equal({id:234});

					expect(stubs.class3.getCall(0).args[0])
					.to.equal(345);

					expect(stubs.class4.getCall(0))
					.to.equal(null);

					expect(instructions)
					.to.deep.equal({
						'class-1': [{
							$ref: 'ref-2',
							$type: 'read',
							n: 1
						}],
						'class-2': [{
							$ref: 'ref-1',
							$type: 'read-create',
							n: 2,
							class1Id: 'ref-2'
						}],
						'class-3': [{
							$ref: 'ref-0',
							$type: 'update-create',
							n: 3,
							class2Id: 'ref-1'
						}]
					});

					done();
				}).catch(done);
			});

			it('should properly allow the ensuring with a stub of a table', function(done){
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

				inflate(
					'class-3', 
					{
						keys: [345], 
						ensure: ['class-2'],
						stub: ['class-2']
					}, 
					nexus, 
					{}
				).then(instructions => {
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
							$type: 'read-create',
							n: 2,
							class1Id: 123
						}],
						'class-3': [{
							$ref: 'ref-0',
							$type: 'update-create',
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
		let class1 = null;
		let class2 = null;
		let class3 = null;
		let class4 = null;
		let class5 = null;

		beforeEach(async function(){
			await nexus.configureModel('class-1', {
				source: 'test-1',
				fields: {
					'id': {
						key: true,
					},
					info: {
						index: true
					}
				}
			});

			class1 = await nexus.configureCrud('class-1');

			await nexus.configureModel('class-2', {
				source: 'test-1',
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

			class2 = await nexus.configureCrud('class-2');

			await nexus.configureModel('class-3', {
				source: 'test-1',
				fields: {
					id: {
						key: true,
					}
				}
			});

			class3 = await nexus.configureCrud('class-3');

			await nexus.configureModel('class-4', {
				source: 'test-1',
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

			class4 = await nexus.configureCrud('class-4');

			await nexus.configureModel('class-5', {
				source: 'test-1',
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

			class5 = await nexus.configureCrud('class-5');
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

				inflate(
					'class-1', 
					{
						keys: [123], 
						join: {
							'class-1': ['class-2'],
							'class-2': ['class-5'],
							'class-4': ['class-5']
						}
					}, 
					nexus, 
					{}
				).then(instructions => {

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
							$type: 'update-create',
							n: 1
						}],
						'class-2': [{
							$ref: 'ref-1',
							$type: 'update-create',
							n: 2,
							class1Id: 'ref-0'
						}],
						'class-3': [{
							$ref: 'ref-4',
							$type: 'update-create',
							n: 3
						}],
						'class-4': [{
							$ref: 'ref-3',
							$type: 'update-create',
							n: 4,
							class3Id: 'ref-4'
						}],
						'class-5': [{
							$ref: 'ref-2',
							$type: 'update-create',
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
