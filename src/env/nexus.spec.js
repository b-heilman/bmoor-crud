
const {expect} = require('chai');
const sinon = require('sinon');

const {Context} = require('../server/context.js');

describe('src/env/nexus.js', function(){
	const {Nexus} = require('./nexus.js');

	let nexus = null;
	let stubs = null;
	let ctx = null;

	beforeEach(function(){
		stubs = {};

		ctx = new Context();
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

	describe('::configureModel', function(){
		it('should properly define a model', async function(){
			const model = await nexus.configureModel('test-10', {
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

			expect(model.settings.create)
			.to.deep.equal([
				'zwei',
				'fier',
				'funf'
			]);
		});

		it('should assist in defining links', async function(){
			await nexus.configureModel('test-l-1', {
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

			await nexus.configureModel('test-l-2', {
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

			await nexus.configureModel('test-l-3', {
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

			await nexus.configureModel('test-l-4', {
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

			nexus.configureModel('test-11', {
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
			nexus.configureModel('test-12', {
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

			expect(model.settings.create)
			.to.deep.equal([
				'zwei',
				'fier',
				'funf'
			]);
		});
	});

	describe('::configureCrud', function(){
		let service = null;

		const connector = {
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		describe('model defined first', function(){
			beforeEach(async function(){
				nexus.configureModel('test-13', {
					fields: {
						id: true,
						value: true
					}
				});

				service = await nexus.configureCrud('test-13', connector);
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}, ctx).then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});

		describe('model described second', function(){
			beforeEach(async function(){
				nexus.configureCrud('test-13.5', connector)
				.then(s => {
					service = s;
				});

				await nexus.configureModel('test-13.5', {
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
				}, ctx)
				.then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});
	});

	describe('::loadCrud', function(){
		let service = null;

		const connector = {
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		describe('if loaded before installed', function(){
			beforeEach(async function(){
				nexus.configureModel('test-14', {
					fields: {
						id: true,
						value: true
					}
				});

				const prom = nexus.loadCrud('test-14');

				await nexus.configureCrud('test-14', connector);

				service = await prom;
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}, ctx)
				.then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});

		describe('if loaded after installed', function(){
			beforeEach(async function(){
				nexus.configureModel('test-15', {
					fields: {
						id: true,
						value: true
					}
				});

				await nexus.configureCrud('test-15', connector);

				service = await nexus.loadCrud('test-15');
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}, ctx)
				.then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});
	});
	
	describe('::configureDecorator', function(){
		let service = null;

		const connector = {
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		beforeEach(async function(){
			nexus.configureModel('test-16', {
				fields: {
					id: true,
					value: true
				}
			});

			const prom = nexus.loadCrud('test-16');

			await nexus.configureCrud('test-16', connector);

			service = await prom;
		});

		it('should define the service', async function(){
			await nexus.configureDecorator('test-16', {
				doSomethingCool: async function(info, ctx){
					expect(ctx.test)
					.to.deep.equal({hello: 'world'});

					return this.create(info, ctx);
				}
			});

			ctx.test = {
				hello: 'world'
			};

			await service.doSomethingCool({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk'
			}, ctx)
			.then(res => {
				expect(res).to.deep.equal({
					id: 'something-1',
					value: 'v-1'
				});
			});
		});
	});

	describe('::configureHook', function(){
		let service = null;

		const connector = {
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		beforeEach(async function(){
			nexus.configureModel('test-17', {
				fields: {
					id: true,
					value: true
				}
			});

			const prom = nexus.loadCrud('test-17');

			await nexus.configureCrud('test-17', connector);

			service = await prom;
		});

		it('should define the service', async function(){
			const trace = [];

			await nexus.configureHook('test-17', {
				beforeCreate: async function(){
					trace.push(1);
				}
			});

			await service.create({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk'
			}, ctx)
			.then(res => {
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
			nexus.configureModel('test-17', {
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

			const prom = nexus.loadCrud('test-17');

			await nexus.configureCrud('test-17', connector);

			service = await prom;
		});

		describe('.filter', function(){
			it('should work with a function', async function(){
				const ctx = new Context({
					permissions: {
						'event-something-1': true
					}
				});

				await nexus.configureSecurity('test-17', {
					filterFactory: function(ctx){
						return function(datum){
							return ctx.hasPermission('event-'+datum.eins);
						};
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

				await nexus.configureSecurity('test-17', {
					filterFactory: function(ctx){
						return function(datum){
							return ctx.hasPermission('event-'+datum.eins);
						};
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

				await nexus.configureSecurity('test-17', {
					filterPermission: 'event-something-1',
					adminPermission: 'boom-shaka-laka'
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

				await nexus.configureSecurity('test-17', {
					filterPermission: 'event-something-1'
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

				await nexus.configureSecurity('test-17', {
					filterPermission: 'event-something-1'
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

				await nexus.configureSecurity('test-17', {
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

				await nexus.configureSecurity('test-17', {
					canCreate: function(datum, ctx){
						expect(datum)
						.to.deep.equal({
							eins: 'something-in',
							zwei: 'v-in'
						});

						return ctx.hasPermission('allow-something');
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

				await nexus.configureSecurity('test-17', {
					canCreate: (datum, ctx) => {
						return ctx.hasPermission('allow-something');
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
					
					expect(ex.code)
					.to.equal('BMOOR_CRUD_SERVICE_CAN_CREATE');
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

				await nexus.configureSecurity('test-17', {
					canCreate: function(datum, ctx){
						expect(datum)
						.to.deep.equal({
							eins: 'something-in',
							zwei: 'v-in'
						});

						return ctx.hasPermission('allow-something');
					},
					adminPermission: 'has-admin'
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

				await nexus.configureSecurity('test-17', {
					canUpdate: function(datum, ctx){
						expect(datum)
						.to.deep.equal({
							eins: 'something-1',
							zwei: 'v-1'
						});

						return ctx.hasPermission('allow-something');
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

				await nexus.configureSecurity('test-17', {
					canUpdate: function(datum, ctx){
						return ctx.hasPermission('allow-something');
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
					.to.equal('BMOOR_CRUD_SERVICE_CAN_UPDATE');
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

				await nexus.configureSecurity('test-17', {
					canUpdate: function(datum, ctx){
						return ctx.hasPermission('allow-something');
					},
					adminPermission: 'has-admin'
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

				await nexus.configureSecurity('test-17', {
					canDelete: function(datum, ctx){
						expect(datum)
						.to.deep.equal({
							eins: 'something-1',
							zwei: 'v-1'
						});

						return ctx.hasPermission('allow-something');
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

				await nexus.configureSecurity('test-17', {
					canDelete: function(datum, ctx){
						return ctx.hasPermission('allow-something');
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
					.to.equal('BMOOR_CRUD_SERVICE_CAN_DELETE');
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

				await nexus.configureSecurity('test-17', {
					canDelete: function(datum, ctx){
						return ctx.hasPermission('allow-something');
					},
					adminPermission: 'has-admin'
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

				await nexus.configureSecurity('test-17', {
					createPermission: 'allow-something'
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

				await nexus.configureSecurity('test-17', {
					createPermission: 'allow-something'
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
					.to.equal('BMOOR_CRUD_NEXUS_ALLOW_CREATE');
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

				await nexus.configureSecurity('test-17', {
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

				await nexus.configureSecurity('test-17', {
					updatePermission: 'allow-something'
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
		});

		describe('.delete', function(){
			it('should work with a permission', async function(){
				const ctx = new Context({
					permissions: {
						'allow-something': true
					}
				});

				await nexus.configureSecurity('test-17', {
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

				await nexus.configureSecurity('test-17', {
					deletePermission: 'allow-something'
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
		});
	});

	describe('::configureDocument', function(){
	
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
			await nexus.configureModel('test-item', {
				fields: {
					id: true,
					name: true
				}
			});

			await nexus.configureModel('test-person', {
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

			await nexus.configureModel('test-category', {
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
				'item': 'item-1',
				'personName': 'person-1',
				'categoryName': 'category-1'
			}]);

			await nexus.configureComposite('comp-1', {
				base: 'test-item',
				key: 'id',
				fields: {
					'item': '.name',
					'personName': '> $test-person.name',
					'categoryName':  '> $test-category.name'
				}
			});

			const doc = await nexus.configureDocument('comp-1', connector);

			const res = await doc.read(1, {});

			const args = stubs.execute.getCall(0).args[0];
			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				'models': [
					{
						'series': 'test-item',
						schema: 'test-item',
						joins: []
					},
					{
						'series': 'test-person',
						schema: 'test-person',
						joins: [{
							name: 'test-item',
							optional: false,
							mappings: [{
								to: 'id',
								from: 'itemId'
							}]
						}]
					},
					{
						'series': 'test-category',
						schema: 'test-category',
						joins: [{
							name: 'test-item',
							optional: false,
							mappings: [{
								to: 'id',
								from: 'itemId'
							}]
						}]
					}
				],
				fields: [{
					'series': 'test-item',
					'path': 'name',
					as: 'item'
				}, {
					'series': 'test-person',
					'path': 'name',
					as: 'personName'
				}, {
					'series': 'test-category',
					'path': 'name',
					as: 'categoryName'
				}],
				params: [{
					series: 'test-item',
					path: 'id',
					operation: '=',
					value: 1,
					settings: {}
				}]
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
				await nexus.configureModel('test-item', {
					fields: {
						id: true,
						name: true
					}
				});

				await nexus.configureModel('test-person', {
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

				await nexus.configureModel('test-category', {
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

				await nexus.configureModel('test-2-foo', {
					fields: {
						id: true,
						name: true
					}
				});

				await nexus.configureModel('test-2-bar', {
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

				await nexus.configureModel('test-3-hello', {
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

				await nexus.configureModel('test-3-world', {
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

				await nexus.configureComposite('comp-1', {
					base: 'test-3-hello',
					key: 'id',
					fields: {
						'hello.name': '.name',
						'world.name': '> $test-3-world.name'
					}
				});
				const doc1 = await nexus.configureDocument('comp-1', connector);

				stubs.doc1 = sinon.spy(doc1, 'query');


				await nexus.configureComposite('comp-2', {
					base: 'test-2-foo',
					key: 'id',
					fields: {
						'sub': ['> #comp-1'],
						'fooName': '.name',
						'barName':  '> $test-2-bar.name'
					}
				});
				const doc2 = await nexus.configureDocument('comp-2', connector);

				stubs.doc2 = sinon.spy(doc2, 'query');
			});

			it('should allow composites to chain calls', async function(){
				await nexus.configureComposite('comp-3', {
					base: 'test-item',
					key: 'id',
					fields: {
						'item': '.name',
						'personName': '> $test-person.name',
						'categoryName':  '> $test-category.name',
						'link': '> $test-category.fooId > #comp-2'
					}
				});
				const doc3 = await nexus.configureDocument('comp-3', connector);
				
				// comp-3
				stubs.execute.onCall(0)
				.resolves([{
					'item': 'item-1',
					'personName': 'person-1',
					'categoryName': 'category-1',
					'sub_0': 456
				}]);

				// comp-2
				stubs.execute.onCall(1)
				.resolves([{
					'fooName': 'foo-1',
					'barName': 'bar-1',
					'sub_0': 123
				}]);

				// comp-2
				stubs.execute.onCall(2)
				.resolves([{
					hello: {
						name: 'eins'
					},
					world: {
						name: 'zwei'
					}
				}]);

				const res = await doc3.read(1, {});

				const args0 = stubs.execute.getCall(0).args[0];

				expect(args0.method)
				.to.equal('read');

				expect(args0.query.toJSON())
				.to.deep.equal({
					'models': [
						{
							'series': 'test-item',
							schema: 'test-item',
							joins: []
						},
						{
							'series': 'test-person',
							schema: 'test-person',
							joins: [{
								name: 'test-item',
								optional: false,
								mappings: [{
									to: 'id',
									from: 'itemId'
								}]
							}]
						},
						{
							'series': 'test-category',
							schema: 'test-category',
							joins: [{
								name: 'test-item',
								optional: false,
								mappings: [{
									to: 'id',
									from: 'itemId'
								}]
							}]
						}
					],
					fields: [{
						'series': 'test-item',
						'path': 'name',
						as: 'item'
					},{
						'series': 'test-person',
						'path': 'name',
						as: 'personName'
					},{
						'series': 'test-category',
						'path': 'name',
						as: 'categoryName'
					},{
						'series': 'test-category',
						'path': 'fooId',
						as: 'sub_0'
					}],
					params: [{
						series: 'test-item',
						path: 'id',
						operation: '=',
						value: 1,
						settings:{}
					}]
				});

				expect(stubs.doc2.getCall(0).args[0])
				.to.deep.equal({
					joins: {
						'.id$test-2-foo': 456
					}
				});

				const args1 = stubs.execute.getCall(1).args[0];
				expect(args1.method)
				.to.equal('read');

				expect(args1.query.toJSON())
				.to.deep.equal({
					'models': [
						{
							'series': 'test-2-foo',
							schema: 'test-2-foo',
							joins: []
						},
						{
							'series': 'test-2-bar',
							schema: 'test-2-bar',
							joins: [{
								name: 'test-2-foo',
								optional: false,
								mappings: [{
									to: 'id',
									from: 'fooId'
								}]
							}]
						}
					],
					fields: [{
						series: 'test-2-foo',
						'path': 'name',
						'as': 'fooName'
					},{
						series: 'test-2-foo',
						'path': 'id',
						'as': 'sub_0'
					},{
						series: 'test-2-bar',
						'path': 'name',
						'as': 'barName'
					}],
					params: [{
						series: 'test-2-foo',
						path: 'id',
						operation: '=',
						value: 456,
						settings: {}
					}]
				});

				expect(stubs.doc1.getCall(0).args[0])
				.to.deep.equal({
					joins: {
						'.fooId$test-3-hello': 123
					}
				});

				const args2 = stubs.execute.getCall(2).args[0];
				expect(args2.method)
				.to.equal('read');

				expect(args2.query.toJSON())
				.to.deep.equal({
					'models': [
						{
							'series': 'test-3-hello',
							schema: 'test-3-hello',
							joins: []
						},
						{
							'series': 'test-3-world',
							schema: 'test-3-world',
							joins: [{
								name: 'test-3-hello',
								optional: false,
								mappings: [{
									to: 'id',
									from: 'helloId'
								}]
							}]
						}
					],
					fields: [{
						series: 'test-3-hello',
						'path': 'name',
						'as': 'hello.name'
					}, {
						series: 'test-3-world',
						'path': 'name',
						'as': 'world.name'
					}],
					params: [{
						series: 'test-3-hello',
						path: 'fooId',
						operation: '=',
						value: 123,
						settings: {}
					}]
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
				await nexus.configureComposite('comp-3', {
					base: 'test-item',
					key: 'id',
					fields: {
						'item': '.name',
						'personName': '> $test-person.name',
						'categoryName':  '> $test-category.name',
						'link': ['> $test-category.fooId > $test-2-foo > #comp-1']
					}
				});

				const doc3 = await nexus.configureDocument('comp-3', connector);

				// comp-3
				stubs.execute.onCall(0)
				.resolves([{
					'item': 'item-1',
					'personName': 'person-1',
					'categoryName': 'category-1',
					'sub_0': 456
				}]);

				// comp-2
				stubs.execute.onCall(1)
				.resolves([{
					hello: {
						name: 'eins'
					},
					world: {
						name: 'zwei'
					}
				}]);

				const res = await doc3.read(1, {});

				const args1 = stubs.execute.getCall(0).args[0];

				expect(args1.method)
				.to.equal('read');
				
				expect(args1.query.toJSON())
				.to.deep.equal({
					'models': [
						{
							'series': 'test-item',
							schema: 'test-item',
							joins: []
						},
						{
							'series': 'test-person',
							schema: 'test-person',
							joins: [{
								name: 'test-item',
								optional: false,
								mappings: [{
									to: 'id',
									from: 'itemId'
								}]
							}]
						},
						{
							'series': 'test-category',
							schema: 'test-category',
							joins: [{
								name: 'test-item',
								optional: false,
								mappings: [{
									to: 'id',
									from: 'itemId'
								}]
							}]
						}
					],
					fields: [{
						series: 'test-item',
						'path': 'name',
						'as': 'item'
					}, {
						series: 'test-person',
						'path': 'name',
						'as': 'personName'
					}, {
						series: 'test-category',
						'path': 'name',
						'as': 'categoryName'
					}, {
						series: 'test-category',
						'path': 'fooId',
						'as': 'sub_0'
					}],
					params: [{
						series: 'test-item',
						path: 'id',
						operation: '=',
						value: 1,
						settings: {}
					}]
				});

				const args2 = stubs.execute.getCall(1).args[0];
				
				expect(args2.method)
				.to.equal('read');
				
				expect(args2.query.toJSON())
				.to.deep.equal({
					'models': [
						{
							'series': 'test-3-hello',
							schema: 'test-3-hello',
							joins: []
						},
						{
							'series': 'test-3-world',
							schema: 'test-3-world',
							joins: [{
								name: 'test-3-hello',
								optional: false,
								mappings: [{
									to: 'id',
									from: 'helloId'
								}]
							}]
						},
						{
							series: 'test-2-foo',
							schema: 'test-2-foo',
							joins: [{
								name: 'test-3-hello',
								optional: false,
								mappings: [{
									to: 'fooId',
									from: 'id'
								}]
							}]
						}
					],
					fields: [{
						series: 'test-3-hello',
						'path': 'name',
						'as': 'hello.name'
					}, {
						series: 'test-3-world',
						'path': 'name',
						'as': 'world.name'
					}],
					params: [{
						series: 'test-2-foo',
						path: 'id',
						operation: '=',
						value: 456,
						settings: {}
					}]
				});

				expect(stubs.doc1.getCall(0).args[0])
				.to.deep.equal({
					joins: {
						'.id$test-2-foo.id>.fooId$test-3-hello': 456
					}
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
