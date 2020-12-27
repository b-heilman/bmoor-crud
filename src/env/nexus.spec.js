
const {expect} = require('chai');
const sinon = require('sinon');

describe('src/env/nexus.js', function(){
	const {Nexus} = require('./nexus.js');

	let nexus = null;
	let stubs = null;

	beforeEach(function(){
		stubs = {};
		nexus = new Nexus();
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => {
			if (stub.retore){
				stub.restore();
			}
		});
	});

	describe('::setModel', function(){
		it('should properly define a model', async function(){
			const model = await nexus.setModel('test-10', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					zwei: true,
					drei: false,
					fier: {
						create: true,
						read: true,
						update: false
					},
					funf: {
						create: true,
						read: true,
						update: false,
						index: true
					}
				}
			});

			expect(model.properties.create)
			.to.deep.equal([
				'zwei',
				'fier',
				'funf'
			]);
		});

		it('should assist in defining links', async function(){
			await nexus.setModel('test-l-1', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					zwei: {
						read: true,
						link: {
							name: 'test-l-2',
							field: 'id'
						}
					}
				}
			});

			await nexus.setModel('test-l-2', {
				fields: {
					id: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					drei: {
						read: true,
						link: {
							name: 'test-l-3',
							field: 'id'
						}
					},
					fier: {
						read: true,
						link: {
							name: 'test-l-4',
							field: 'id'
						}
					}
				}
			});

			await nexus.setModel('test-l-3', {
				fields: {
					id: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					}
				}
			});

			await nexus.setModel('test-l-4', {
				fields: {
					id: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					}
				}
			});

			expect(nexus.mapper.getLink('test-l-2').reduceConnections())
			.to.deep.equal([
				{ 
					name: 'test-l-1',
					local: 'id',
					remote: 'zwei', 
					metadata: {
						direction: 'incoming'
					}
				},
				{
					name: 'test-l-3',
					local: 'drei',
					remote: 'id', 
					metadata: {
						direction: 'outgoing'
					}
				},
				{
					name: 'test-l-4',
					local: 'fier',
					remote: 'id', 
					metadata: {
						direction: 'outgoing'
					}
				}
			]);
		});
	});

	describe('::loadModel', function(){
		it('should resolve after model is defined', async function(){
			let model = null;

			const holder = nexus.loadModel('test-11')
			.then(m => {
				model = m;
			});

			nexus.setModel('test-11', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					zwei: true,
					drei: false,
					fier: {
						create: true,
						read: true,
						update: false
					},
					funf: {
						create: true,
						read: true,
						update: false,
						index: true
					}
				}
			});

			expect(model)
			.to.be.an('null');

			await holder;

			expect(model)
			.not.to.be.an('null');
		});

		it('should resolve if the model was already defined', async function(){
			nexus.setModel('test-12', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					zwei: true,
					drei: false,
					fier: {
						create: true,
						read: true,
						update: false
					},
					funf: {
						create: true,
						read: true,
						update: false,
						index: true
					}
				}
			});

			const model = await nexus.loadModel('test-12');

			expect(model.properties.create)
			.to.deep.equal([
				'zwei',
				'fier',
				'funf'
			]);
		});
	});

	describe('::installService', function(){
		let service = null;

		const connector = {
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		describe('model defined first', function(){
			beforeEach(async function(){
				nexus.setModel('test-13', {
					fields: {
						id: true,
						value: true
					}
				});

				service = await nexus.installService('test-13', connector);
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}).then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});

		describe('model described second', function(){
			beforeEach(async function(){
				nexus.installService('test-13.5', connector)
				.then(s => {
					service = s;
				});

				await nexus.setModel('test-13.5', {
					fields: {
						id: true,
						value: true
					}
				});
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}).then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});
	});

	describe('::loadService', function(){
		let service = null;

		const connector = {
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		describe('if loaded before installed', function(){
			beforeEach(async function(){
				nexus.setModel('test-14', {
					fields: {
						id: true,
						value: true
					}
				});

				const prom = nexus.loadService('test-14');

				await nexus.installService('test-14', connector);

				service = await prom;
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}).then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});

		describe('if loaded after installed', function(){
			beforeEach(async function(){
				nexus.setModel('test-15', {
					fields: {
						id: true,
						value: true
					}
				});

				await nexus.installService('test-15', connector);

				service = await nexus.loadService('test-15');
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}).then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});
	});
	
	describe('::applyDecorator', function(){
		let service = null;

		const connector = {
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		beforeEach(async function(){
			nexus.setModel('test-16', {
				fields: {
					id: true,
					value: true
				}
			});

			const prom = nexus.loadService('test-16');

			await nexus.installService('test-16', connector);

			service = await prom;
		});

		it('should define the service', async function(){
			await nexus.applyDecorator('test-16', {
				doSomethingCool: async function(info, ctx){
					expect(ctx)
					.to.deep.equal({hello: 'world'});

					return this.create(info);
				}
			});

			await service.doSomethingCool({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk'
			}, {
				hello: 'world'
			}).then(res => {
				expect(res).to.deep.equal({
					id: 'something-1',
					value: 'v-1'
				});
			});
		});
	});

	describe('::applyHook', function(){
		let service = null;

		const connector = {
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		beforeEach(async function(){
			nexus.setModel('test-17', {
				fields: {
					id: true,
					value: true
				}
			});

			const prom = nexus.loadService('test-17');

			await nexus.installService('test-17', connector);

			service = await prom;
		});

		it('should define the service', async function(){
			const trace = [];

			await nexus.applyHook('test-17', {
				beforeCreate: async function(){
					trace.push(1);
				}
			});

			await service.create({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk'
			}).then(res => {
				expect(res)
				.to.deep.equal({
					id: 'something-1',
					value: 'v-1'
				});
			});

			expect(trace)
			.to.deep.equal([1]);
		});
	});

	describe('::installSecurity', function(){
		const {Context} = require('../server/context.js');

		let service = null;

		const connector = {
			execute: () => Promise.resolve([{
				eins: 'something-1',
				zwei: 'v-1'
			}])
		};

		beforeEach(async function(){
			nexus.setModel('test-17', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					zwei: true
				}
			});

			const prom = nexus.loadService('test-17');

			await nexus.installService('test-17', connector);

			service = await prom;
		});

		describe('.filter', function(){
			it('should work with a function', async function(){
				const ctx = new Context({
					permissions: {
						'event-something-1': true
					}
				});

				await nexus.applySecurity('test-17', {
					filter: function(datum){
						return 'event-'+datum.eins;
					}
				});

				expect(await service.readAll(ctx))
				.to.deep.equal([{
					eins: 'something-1',
					zwei: 'v-1'
				}]);
			});

			it('should fail with a function', async function(){
				const ctx = new Context({
					permissions: {
						'event-something-1': false
					}
				});

				await nexus.applySecurity('test-17', {
					filter: function(datum){
						return 'event-'+datum.eins;
					}
				});

				expect(await service.readAll(ctx))
				.to.deep.equal([]);
			});

			it('should work with a function as admin', async function(){
				const ctx = new Context({
					permissions: {
						'event-something-1': false,
						'boom-shaka-laka': true
					}
				});

				await nexus.applySecurity('test-17', {
					filter: function(datum){
						return 'event-'+datum.eins;
					},
					isAdmin: 'boom-shaka-laka'
				});

				expect(await service.readAll(ctx))
				.to.deep.equal([{
					eins: 'something-1',
					zwei: 'v-1'
				}]);
			});

			it('should work with a permission', async function(){
				const ctx = new Context({
					permissions: {
						'event-something-1': true
					}
				});

				await nexus.applySecurity('test-17', {
					filter: 'event-something-1'
				});

				expect(await service.readAll(ctx))
				.to.deep.equal([{
					eins: 'something-1',
					zwei: 'v-1'
				}]);
			});

			it('should fail with a permission', async function(){
				const ctx = new Context({
					permissions: {
						'event-something-1': false
					}
				});

				await nexus.applySecurity('test-17', {
					filter: 'event-something-1'
				});

				expect(await service.readAll(ctx))
				.to.deep.equal([]);
			});

			it('should work with a permission as admin', async function(){
				const ctx = new Context({
					permissions: {
						'event-something-1': true
					}
				});

				await nexus.applySecurity('test-17', {
					filter: 'junk',
					isAdmin: 'event-something-1'
				});

				expect(await service.readAll(ctx))
				.to.deep.equal([{
					eins: 'something-1',
					zwei: 'v-1'
				}]);
			});
		});

		describe('.allowCreate', function(){
			it('should work with a function', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': true
					}
				});

				await nexus.applySecurity('test-17', {
					allowCreate: function(datum){
						expect(datum)
						.to.deep.equal({
							eins: 'something-in',
							zwei: 'v-in'
						});

						return 'allow-something';
					},
				});

				expect(await service.create(
					{
						eins: 'something-in',
						zwei: 'v-in'
					},
					ctx
				)).to.deep.equal({
					eins: 'something-1',
					zwei: 'v-1'
				});
			});

			it('should fail with a function', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': false
					}
				});

				await nexus.applySecurity('test-17', {
					allowCreate: function(){
						return 'allow-something';
					}
				});

				let failed = false;
				try {
					await service.create(
						{
							eins: 'something-in',
							zwei: 'v-in'
						},
						ctx
					);
				} catch(ex){
					failed = true;
					console.log(ex);
					expect(ex.code)
					.to.equal('BMOOR_CRUD_NEXUS_ALLOW_CREATE');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should work with a function as admin', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': false,
						'has-admin': true
					}
				});

				await nexus.applySecurity('test-17', {
					allowCreate: function(datum){
						expect(datum)
						.to.deep.equal({
							eins: 'something-in',
							zwei: 'v-in'
						});

						return 'allow-something';
					},
					isAdmin: 'has-admin'
				});

				expect(await service.create(
					{
						eins: 'something-in',
						zwei: 'v-in'
					},
					ctx
				)).to.deep.equal({
					eins: 'something-1',
					zwei: 'v-1'
				});
			});
		});

		describe('.allowUpdate', function(){
			it('should work with a function', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': true,
						'has-admin': true
					}
				});

				await nexus.applySecurity('test-17', {
					allowUpdate: function(id, delta, datum){
						expect(id)
						.to.deep.equal(123);

						expect(delta)
						.to.deep.equal({
							eins: 'something-in',
							zwei: 'v-in'
						});

						expect(datum)
						.to.deep.equal({
							eins: 'something-1',
							zwei: 'v-1'
						});

						return 'allow-something';
					}
				});

				expect(await service.update(
					123,
					{
						eins: 'something-in',
						zwei: 'v-in'
					},
					ctx
				)).to.deep.equal({
					eins: 'something-1',
					zwei: 'v-1'
				});
			});

			it('should fail with a function', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': false,
						'has-admin': true
					}
				});

				await nexus.applySecurity('test-17', {
					allowUpdate: function(){
						return 'allow-something';
					}
				});

				let failed = false;
				try {
					await service.update(
						123,
						{
							eins: 'something-in',
							zwei: 'v-in'
						},
						ctx
					);
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_NEXUS_ALLOW_UPDATE');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should work with a function as admin', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': false,
						'has-admin': true
					}
				});

				await nexus.applySecurity('test-17', {
					allowUpdate: function(){
						return 'allow-something';
					},
					isAdmin: 'has-admin'
				});

				expect(await service.update(
					123,
					{
						eins: 'something-in',
						zwei: 'v-in'
					},
					ctx
				)).to.deep.equal({
					eins: 'something-1',
					zwei: 'v-1'
				});
			});
		});

		describe('.allowDelete', function(){
			it('should work with a function', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': true,
						'has-admin': true
					}
				});

				await nexus.applySecurity('test-17', {
					allowDelete: function(id, datum){
						expect(id)
						.to.deep.equal(123);

						expect(datum)
						.to.deep.equal({
							eins: 'something-1',
							zwei: 'v-1'
						});

						return 'allow-something';
					}
				});

				expect(await service.delete(
					123,
					ctx
				)).to.deep.equal({
					eins: 'something-1',
					zwei: 'v-1'
				});
			});

			it('should fail with a function', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': false,
						'has-admin': true
					}
				});

				await nexus.applySecurity('test-17', {
					allowDelete: function(){
						return 'allow-something';
					}
				});

				let failed = false;
				try {
					await service.delete(
						123,
						ctx
					);
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_NEXUS_ALLOW_DELETE');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should work with a function as admin', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': false,
						'has-admin': true
					}
				});

				await nexus.applySecurity('test-17', {
					allowDelete: function(){
						return 'allow-something';
					},
					isAdmin: 'has-admin'
				});

				expect(await service.delete(
					123,
					ctx
				)).to.deep.equal({
					eins: 'something-1',
					zwei: 'v-1'
				});
			});
		});

		describe('.create', function(){
			it('should work with a permission', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': true
					}
				});

				await nexus.applySecurity('test-17', {
					create: 'allow-something'
				});

				expect(await service.create(
					{
						eins: 'something-in',
						zwei: 'v-in'
					},
					ctx
				)).to.deep.equal({
					eins: 'something-1',
					zwei: 'v-1'
				});
			});

			it('should fail with a permission', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': false
					}
				});

				await nexus.applySecurity('test-17', {
					create: 'allow-something'
				});

				let failed = false;
				try {
					await service.create(
						{
							eins: 'something-in',
							zwei: 'v-in'
						},
						ctx
					);
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_NEXUS_CAN_CREATE');
				}

				expect(failed)
				.to.equal(true);
			});
		});

		describe('.update', function(){
			it('should work with a permission', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': true
					}
				});

				await nexus.applySecurity('test-17', {
					update: 'allow-something'
				});

				expect(await service.update(
					123,
					{
						eins: 'something-in',
						zwei: 'v-in'
					},
					ctx
				)).to.deep.equal({
					eins: 'something-1',
					zwei: 'v-1'
				});
			});

			it('should fail with a permission', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': false
					}
				});

				await nexus.applySecurity('test-17', {
					update: 'allow-something'
				});

				let failed = false;
				try {
					await service.update(
						123,
						{
							eins: 'something-in',
							zwei: 'v-in'
						},
						ctx
					);
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_NEXUS_CAN_UPDATE');
				}

				expect(failed)
				.to.equal(true);
			});
		});

		describe('.delete', function(){
			it('should work with a permission', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': true
					}
				});

				await nexus.applySecurity('test-17', {
					delete: 'allow-something'
				});

				expect(await service.delete(
					123,
					ctx
				)).to.deep.equal({
					eins: 'something-1',
					zwei: 'v-1'
				});
			});

			it('should fail with a permission', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': false
					}
				});

				await nexus.applySecurity('test-17', {
					delete: 'allow-something'
				});

				let failed = false;
				try {
					await service.delete(
						123,
						ctx
					);
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_NEXUS_CAN_DELETE');
				}

				expect(failed)
				.to.equal(true);
			});
		});
	});

	describe('::installDocument', function(){
	
		let connector = null;
	
		beforeEach(function(){
			stubs = {
				execute: sinon.stub()
			};

			connector = {
				execute: stubs.execute
			};
		});

		it('should allow simple install', async function(){
			await nexus.setModel('test-item', {
				fields: {
					id: true,
					name: true
				}
			});

			await nexus.setModel('test-person', {
				fields: {
					id: true,
					name: true,
					itemId: {
						read: true,
						write: true,
						link: {
							name: 'test-item',
							field: 'id'
						}
					}
				}
			});

			await nexus.setModel('test-category', {
				fields: {
					id: true,
					name: true,
					itemId: {
						read: true,
						write: true,
						link: {
							name: 'test-item',
							field: 'id'
						}
					}
				}
			});

			stubs.execute.onCall(0)
			.resolves([{
				'test-item_0': 'item-1',
				'test-person_1': 'person-1',
				'test-category_2': 'category-1'
			}]);

			await nexus.setComposite('comp-1', {
				base: 'test-item',
				key: 'id',
				fields: {
					'item': '.name',
					'personName': '> $test-person.name',
					'categoryName':  '> $test-category.name'
				}
			});

			const doc = await nexus.installDocument('comp-1', connector);

			const res = await doc.read(1, {});

			expect(stubs.execute.getCall(0).args[0])
			.to.deep.equal({
				'method': 'read',
				'models': [
					{
						'name': 'test-item',
						'series': 'test-item',
						'fields': [
							{
								'path': 'name',
								'as': 'test-item_0'
							}
						],
						'query': {
							'id': 1
						},
						schema: 'test-item'
					},
					{
						'name': 'test-person',
						'series': 'test-person',
						'fields': [
							{
								'path': 'name',
								'as': 'test-person_1'
							}
						],
						'query': null,
						join: {
							on: [{
								name: 'test-item',
								remote: 'id',
								local: 'itemId'
							}]
						},
						schema: 'test-person'
					},
					{
						'name': 'test-category',
						'series': 'test-category',
						'fields': [
							{
								'path': 'name',
								'as': 'test-category_2'
							}
						],
						'query': null,
						join: {
							on: [{
								name: 'test-item',
								remote: 'id',
								local: 'itemId'
							}]
						},
						schema: 'test-category'
					}
				]
			});

			expect(res)
			.to.deep.equal({
				item: 'item-1',
				personName: 'person-1',
				categoryName: 'category-1'
			});
		});

		describe('multi-tiered definitions', function(){
			beforeEach(async function(){
				await nexus.setModel('test-item', {
					fields: {
						id: true,
						name: true
					}
				});

				await nexus.setModel('test-person', {
					fields: {
						id: true,
						name: true,
						itemId: {
							read: true,
							write: true,
							link: {
								name: 'test-item',
								field: 'id'
							}
						}
					}
				});

				await nexus.setModel('test-category', {
					fields: {
						id: true,
						name: true,
						itemId: {
							read: true,
							write: true,
							link: {
								name: 'test-item',
								field: 'id'
							}
						},
						fooId: {
							read: true,
							write: true,
							link: {
								name: 'test-2-foo',
								field: 'id'
							}
						}
					}
				});

				await nexus.setModel('test-2-foo', {
					fields: {
						id: true,
						name: true
					}
				});

				await nexus.setModel('test-2-bar', {
					fields: {
						id: true,
						name: true,
						fooId: {
							read: true,
							write: true,
							link: {
								name: 'test-2-foo',
								field: 'id'
							}
						}
					}
				});

				await nexus.setModel('test-3-hello', {
					fields: {
						id: true,
						name: true,
						fooId: {
							read: true,
							write: true,
							link: {
								name: 'test-2-foo',
								field: 'id'
							}
						}
					}
				});

				await nexus.setModel('test-3-world', {
					fields: {
						id: true,
						name: true,
						helloId: {
							read: true,
							write: true,
							link: {
								name: 'test-3-hello',
								field: 'id'
							}
						}
					}
				});

				await nexus.setComposite('comp-1', {
					base: 'test-3-hello',
					key: 'id',
					fields: {
						'hello.name': '.name',
						'world.name': '> $test-3-world.name'
					}
				});
				const doc1 = await nexus.installDocument('comp-1', connector);

				stubs.doc1 = sinon.spy(doc1, 'query');


				await nexus.setComposite('comp-2', {
					base: 'test-2-foo',
					key: 'id',
					fields: {
						'sub': ['> #comp-1'],
						'fooName': '.name',
						'barName':  '> $test-2-bar.name'
					}
				});
				const doc2 = await nexus.installDocument('comp-2', connector);

				stubs.doc2 = sinon.spy(doc2, 'query');
			});

			it('should allow composites to chain calls', async function(){
				await nexus.setComposite('comp-3', {
					base: 'test-item',
					key: 'id',
					fields: {
						'item': '.name',
						'personName': '> $test-person.name',
						'categoryName':  '> $test-category.name',
						'link': '> $test-category.fooId > #comp-2'
					}
				});
				const doc3 = await nexus.installDocument('comp-3', connector);
				
				// comp-3
				stubs.execute.onCall(0)
				.resolves([{
					'test-item_0': 'item-1',
					'test-person_1': 'person-1',
					'test-category_2': 'category-1',
					'test-category_3': 456
				}]);

				// comp-2
				stubs.execute.onCall(1)
				.resolves([{
					'test-2-foo_0': 'foo-1',
					'test-2-bar_1': 'bar-1',
					'test-2-foo_2': 123
				}]);

				// comp-2
				stubs.execute.onCall(2)
				.resolves([{
					'test-3-hello_0': 'eins',
					'test-3-world_1': 'zwei'
				}]);

				const res = await doc3.read(1, {});

				expect(stubs.execute.getCall(0).args[0])
				.to.deep.equal({
					'method': 'read',
					'models': [
						{
							'name': 'test-item',
							'series': 'test-item',
							'fields': [
								{
									'path': 'name',
									'as': 'test-item_0'
								}
							],
							'query': {
								'id': 1
							},
							schema: 'test-item'
						},
						{
							'name': 'test-person',
							'series': 'test-person',
							'fields': [
								{
									'path': 'name',
									'as': 'test-person_1'
								}
							],
							'query': null,
							join: {
								on: [{
									name: 'test-item',
									remote: 'id',
									local: 'itemId'
								}]
							},
							schema: 'test-person'
						},
						{
							'name': 'test-category',
							'series': 'test-category',
							'fields': [
								{
									'path': 'name',
									'as': 'test-category_2'
								},
								{
									'path': 'fooId',
									'as': 'test-category_3'
								}
							],
							'query': null,
							join: {
								on: [{
									name: 'test-item',
									remote: 'id',
									local: 'itemId'
								}]
							},
							schema: 'test-category'
						}
					]
				});

				expect(stubs.doc2.getCall(0).args[0])
				.to.deep.equal({
					'.id$test-2-foo': 456
				});

				expect(stubs.execute.getCall(1).args[0])
				.to.deep.equal({
					'method': 'read',
					'models': [
						{
							'name': 'test-2-foo',
							'series': 'test-2-foo',
							'fields': [
								{
									'path': 'name',
									'as': 'test-2-foo_0'
								},
								{
									'path': 'id',
									'as': 'test-2-foo_2'
								}
							],
							'query': {
								'id': 456
							},
							schema: 'test-2-foo'
						},
						{
							'name': 'test-2-bar',
							'series': 'test-2-bar',
							'fields': [
								{
									'path': 'name',
									'as': 'test-2-bar_1'
								}
							],
							'query': null,
							join: {
								on: [{
									name: 'test-2-foo',
									remote: 'id',
									local: 'fooId'
								}]
							},
							schema: 'test-2-bar'
						}
					]
				});

				expect(stubs.doc1.getCall(0).args[0])
				.to.deep.equal({
					'.fooId$test-3-hello': 123
				});

				expect(stubs.execute.getCall(2).args[0])
				.to.deep.equal({
					'method': 'read',
					'models': [
						{
							'name': 'test-3-hello',
							'series': 'test-3-hello',
							'fields': [
								{
									'path': 'name',
									'as': 'test-3-hello_0'
								}
							],
							'query': {
								'fooId': 123
							},
							schema: 'test-3-hello'
						},
						{
							'name': 'test-3-world',
							'series': 'test-3-world',
							'fields': [
								{
									'path': 'name',
									'as': 'test-3-world_1'
								}
							],
							'query': null,
							join: {
								on: [{
									name: 'test-3-hello',
									remote: 'id',
									local: 'helloId'
								}]
							},
							schema: 'test-3-world'
						}
					]
				});

				expect(res)
				.to.deep.equal({
					item: 'item-1',
					personName: 'person-1',
					categoryName: 'category-1',
					link: {
						sub: [{
							hello: {
								name: 'eins'
							},
							world: {
								name: 'zwei'
							}
						}],
						fooName: 'foo-1',
						barName: 'bar-1'
					}
				});
			});

			it('should allow composites to skip calls', async function(){
				await nexus.setComposite('comp-3', {
					base: 'test-item',
					key: 'id',
					fields: {
						'item': '.name',
						'personName': '> $test-person.name',
						'categoryName':  '> $test-category.name',
						'link': ['> $test-category.fooId > $test-2-foo > #comp-1']
					}
				});

				const doc3 = await nexus.installDocument('comp-3', connector);

				// comp-3
				stubs.execute.onCall(0)
				.resolves([{
					'test-item_0': 'item-1',
					'test-person_1': 'person-1',
					'test-category_2': 'category-1',
					'test-category_3': 456
				}]);

				// comp-2
				stubs.execute.onCall(1)
				.resolves([{
					'test-3-hello_0': 'eins',
					'test-3-world_1': 'zwei'
				}]);

				const res = await doc3.read(1, {});

				expect(stubs.execute.getCall(0).args[0])
				.to.deep.equal({
					'method': 'read',
					'models': [
						{
							'name': 'test-item',
							'series': 'test-item',
							'fields': [
								{
									'path': 'name',
									'as': 'test-item_0'
								}
							],
							'query': {
								'id': 1
							},
							schema: 'test-item'
						},
						{
							'name': 'test-person',
							'series': 'test-person',
							'fields': [
								{
									'path': 'name',
									'as': 'test-person_1'
								}
							],
							'query': null,
							join: {
								on: [{
									name: 'test-item',
									remote: 'id',
									local: 'itemId'
								}]
							},
							schema: 'test-person'
						},
						{
							'name': 'test-category',
							'series': 'test-category',
							'fields': [
								{
									'path': 'name',
									'as': 'test-category_2'
								},
								{
									'path': 'fooId',
									'as': 'test-category_3'
								}
							],
							'query': null,
							join: {
								on: [{
									name: 'test-item',
									remote: 'id',
									local: 'itemId'
								}]
							},
							schema: 'test-category'
						}
					]
				});

				expect(stubs.execute.getCall(1).args[0])
				.to.deep.equal({
					'method': 'read',
					'models': [
						{
							'name': 'test-3-hello',
							'series': 'test-3-hello',
							'fields': [
								{
									'path': 'name',
									'as': 'test-3-hello_0'
								}
							],
							'query': null,
							schema: 'test-3-hello'
						},
						{
							'name': 'test-3-world',
							'series': 'test-3-world',
							'fields': [
								{
									'path': 'name',
									'as': 'test-3-world_1'
								}
							],
							'query': null,
							join: {
								on: [{
									name: 'test-3-hello',
									remote: 'id',
									local: 'helloId'
								}]
							},
							schema: 'test-3-world'
						},
						{
							name: 'test-2-foo',
							series: 'test-2-foo',
							schema: 'test-2-foo',
							fields: [],
							'query': {
								'id': 456
							},
							join: {
								on: [{
									name: 'test-3-hello',
									local: 'id',
									remote: 'fooId'
								}]
							}
						}
					]
				});

				expect(stubs.doc1.getCall(0).args[0])
				.to.deep.equal({
					'.id$test-2-foo.id>.fooId$test-3-hello': 456
				});

				expect(res)
				.to.deep.equal({
					item: 'item-1',
					personName: 'person-1',
					categoryName: 'category-1',
					link: [{
						hello: {
							name: 'eins'
						},
						world: {
							name: 'zwei'
						}
					}]
				});
			});
		});
	});
});
