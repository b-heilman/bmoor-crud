
const {expect} = require('chai');
const sinon = require('sinon');

const {Bus} = require('../server/bus.js');
const {Nexus} = require('./nexus.js');
const {Context} = require('../server/context.js');

const sut = require('./forge.js');

describe('src/env/forge.js', function(){
	let bus = null;
	let stubs = null;
	let nexus = null;
	let forge = null;

	beforeEach(function(){
		stubs = {};

		bus = new Bus();
		nexus = new Nexus();

		forge = new sut.Forge(nexus, bus);		
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => {
			if (stub.restore){
				stub.restore();
			}
		});
	});

	describe('eventing', function(){
		let ctx = null;

		let service1 = null;
		let service2 = null;

		let interface1 = null;
		let interface2 = null;

		beforeEach(async function(){
			ctx = new Context({method: ''});

			nexus.setModel('service-1', {
				fields: {
					id: {
						key: true,
						read: true
					},
					foo: true,
					hello: false
				}
			});

			nexus.setModel('service-2', {
				fields: {
					id: {
						key: true,
						read: true
					},
					foo: true,
					hello: true
				}
			});

			interface1 = {};
			interface2 = {};

			service1 = await nexus.installService('service-1', interface1);
			service2 = await nexus.installService('service-2', interface2);
		});

		describe('::configureService', function(){
			it('should allow for the subscription of afterCreate events', async function(){
				interface1.execute = () => Promise.resolve([{
					foo: 'bar',
					id: 10
				}]);

				bus.broadcast.on('service-1.create', function(was, datum, myCtx){
					expect(datum)
					.to.deep.equal({id:10, foo: 'bar'});

					expect(ctx)
					.to.equal(myCtx);

					myCtx.addChange('foo', 'bar', 2, {hello: 'world'});
				});

				await forge.configureService('service-1');

				const res = await service1.create({eins: 1}, ctx);

				expect(res)
				.to.deep.equal({id:10, foo: 'bar'});

				expect(ctx.getChanges())
				.to.deep.equal([{
					model: 'foo',
					action: 'bar',
					key: 2,
					from: {hello: 'world'},
					to: null,
					md: {}
				}, {
					model: 'service-1',
					action: 'create',
					key: 10,
					to: {id: 10, foo: 'bar'},
					from: null,
					md: {}
				}]);
			});

			it('should allow for the subscription of afterUpdate events', async function(){
				interface1.execute = () => Promise.resolve([{
					id: 20,
					foo: 'bar'
				}]);

				bus.broadcast.on('service-1.update', function(was, datum, myCtx){
					expect(datum)
					.to.deep.equal({id: 20, foo: 'bar'});

					expect(ctx)
					.to.equal(myCtx);

					myCtx.addChange('foo', 'bar', 3, {hello: 'world'});
				});

				await forge.configureService('service-1');

				const res = await service1.update(1, {eins: 1}, ctx);

				expect(res)
				.to.deep.equal({id: 20,foo: 'bar'});

				expect(ctx.getChanges())
				.to.deep.equal([{
					model: 'foo',
					action: 'bar',
					key: 3,
					from: {hello: 'world'},
					to: null,
					md: {}
				}, {
					model: 'service-1',
					action: 'update',
					key: 1,
					to: {
						id: 20,
						foo: 'bar'
					},
					from: {
						id: 20,
						foo: 'bar'
					},
					md: {}
				}]);
			});

			it('should allow for the subscription of afterDelete events', async function(){
				interface1.execute = () => Promise.resolve([{
					foo: 'bar'
				}]);

				bus.broadcast.on('service-1.delete', function(datum, _, myCtx){
					expect(datum)
					.to.deep.equal({foo: 'bar'});

					expect(ctx)
					.to.equal(myCtx);

					myCtx.addChange('foo', 'bar', 3, {hello: 'world'});
				});

				await forge.configureService('service-1');

				const res = await service1.delete(1, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});

				expect(ctx.getChanges())
				.to.deep.equal([{
					model: 'foo',
					action: 'bar',
					key: 3,
					from: {hello: 'world'},
					to: null,
					md: {}
				}, {
					model: 'service-1',
					action: 'delete',
					key: 1,
					to: null,
					from: {foo: 'bar'},
					md: {}
				}]);
			});
		});

		describe('::subscribe', function(){
			it('should subscribe to afterCreate', async function(){
				let triggered = false;

				await forge.subscribe('service-1', [{
					model: 'foo-bar',
					action: 'create',
					callback: function(service, eins, zwei){
						expect(service)
						.to.equal(service1);

						expect(eins)
						.to.equal(1);

						expect(zwei)
						.to.equal(2);

						triggered = true;
					}
				}]);

				await bus.broadcast.trigger('foo-bar.create', 1, 2);
			
				expect(triggered)
				.to.equal(true);
			});

			it('should allow stacking of triggers', async function(){
				let triggered = 0;

				await forge.subscribe('service-1', [{
					model: 'foo-bar',
					action: 'create',
					callback: function(){
						triggered++;
					}
				},{
					model: 'foo-bar',
					action: 'create',
					callback: function(){
						triggered++;
					}
				}]);

				await bus.broadcast.trigger('foo-bar.create', 1, 2);
			
				expect(triggered)
				.to.equal(2);
			});

			it('should subscribe to afterUpdate', async function(){
				let triggered = false;

				await forge.subscribe('service-1', [{
					model: 'foo-bar',
					action: 'update',
					callback: function(service, eins, zwei){
						expect(service)
						.to.equal(service1);

						expect(eins)
						.to.equal(1);

						expect(zwei)
						.to.equal(2);

						triggered = true;
					}
				}]);

				await bus.broadcast.trigger('foo-bar.update', 1, 2);
			
				expect(triggered)
				.to.equal(true);
			});

			it('should subscribe to afterDelete', async function(){
				let triggered = false;

				await forge.subscribe('service-1', [{
					model: 'foo-bar',
					action: 'delete',
					callback: function(service, eins, zwei){
						expect(service)
						.to.equal(service1);

						expect(eins)
						.to.equal(1);

						expect(zwei)
						.to.equal(2);

						triggered = true;
					}
				}]);

				await bus.broadcast.trigger('foo-bar.delete', 1, 2);
			
				expect(triggered)
				.to.equal(true);
			});
		});

		describe('::configureService should play nice with ::subscribe', function(){
			it('should work for create', async function(){
				interface1.execute = () => Promise.resolve([{
					id: 30,
					foo: 'bar'
				}]);

				interface2.execute = () => Promise.resolve([{
					id: 31,
					hello: 'world'
				}]);

				await forge.configureService('service-1');

				await forge.subscribe('service-2', [{
					model: 'service-1',
					action: 'create',
					callback: function(service, was, datum, myCtx){
						expect(service)
						.to.equal(service2);

						expect(datum)
						.to.deep.equal({id: 30, foo: 'bar'});

						return service.create({'this-is': 'junk'}, myCtx);
					}
				}]);

				await service1.create({eins: 1}, ctx);

				expect(ctx.getChanges())
				.to.deep.equal([{
					model: 'service-2',
					action: 'create',
					key: 31,
					from: null,
					to: {
						id: 31,
						hello: 'world'
					},
					md: {}
				}, {
					model: 'service-1',
					action: 'create',
					key: 30,
					from: null,
					to: {
						id: 30,
						foo: 'bar'
					},
					md: {}
				}]);
			});

			it('should work for update', async function(){
				interface1.execute = () => Promise.resolve([{
					foo: 'bar',
					id: 40
				}]);

				interface2.execute = () => Promise.resolve([{
					hello: 'world',
					id: 41
				}]);

				await forge.configureService('service-1');

				await forge.subscribe('service-2', [{
					model: 'service-1',
					action: 'update',
					callback: function(service, was, datum, myCtx){
						expect(service)
						.to.equal(service2);

						expect(datum)
						.to.deep.equal({id: 40, foo: 'bar'});

						return service.create({'this-is': 'junk'}, myCtx);
					}
				}]);

				await service1.update(1, {eins: 1}, ctx);

				expect(ctx.getChanges())
				.to.deep.equal([{
					model: 'service-2',
					action: 'create',
					key: 41,
					from: null,
					to: {
						id: 41,
						hello: 'world'
					},
					md: {}
				}, {
					model: 'service-1',
					action: 'update',
					key: 1,
					to: {
						id: 40,
						foo: 'bar'
					},
					from: {
						id: 40,
						foo: 'bar'
					},
					md: {}
				}]);
			});

			it('should work for delete', async function(){
				interface1.execute = () => Promise.resolve([{
					id: 100,
					foo: 'bar'
				}]);

				interface2.execute = () => Promise.resolve([{
					id: 101,
					hello: 'world'
				}]);

				await forge.configureService('service-1');

				await forge.subscribe('service-2', [{
					model: 'service-1',
					action: 'delete',
					callback: function(service, was, datum, myCtx){
						expect(service)
						.to.equal(service2);

						expect(was)
						.to.deep.equal({id: 100, foo: 'bar'});

						return service.create({'this-is': 'junk'}, myCtx);
					}
				}]);

				await service1.delete(1, ctx);

				expect(ctx.getChanges())
				.to.deep.equal([{
					model: 'service-2',
					action: 'create',
					key: 101,
					from: null,
					to: {
						id: 101,
						hello: 'world'
					},
					md: {}
				}, {
					model: 'service-1',
					action: 'delete',
					key: 1,
					to: null,
					from: {
						id: 100,
						foo: 'bar'
					},
					md: {}
				}]);
			});
		});
	});

	describe('::secure via Service::clean', function(){
		let ctx = null;

		let service1 = null;

		let interface1 = null;

		beforeEach(async function(){
			ctx = new Context({method: ''});

			nexus.setModel('service-1', {
				fields: {
					eins: {
						create: true,
						update: true,
						query: true
					},
					zwei: true,
					drei: false,
					fier: {
						create: 'can-create',
						update: 'can-update',
						query: 'can-query'
					}
				}
			});

			interface1 = {
				execute: sinon.stub().resolves([{foo: 'bar'}])
			};

			service1 = await nexus.installService('service-1', interface1);

			// await forge.secure('service-1');
		});

		describe('with blanket rejection', function(){
			beforeEach(function(){
				ctx.hasPermission = () => false;
			});

			describe('create', function(){
				it('should prune fields', async function(){
					await service1.create({
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.execute.getCall(0).args;

					expect(args[0].payload)
					.to.deep.equal({
						eins: 1,
						zwei: 2
					});
				});
			});

			describe('update', function(){
				it('should prune fields', async function(){
					await service1.update(1, {
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.execute.getCall(1).args;
					
					expect(args[0].payload)
					.to.deep.equal({
						eins: 1,
						zwei: 2
					});
				});
			});

			describe('query', function(){
				it('should prune fields', async function(){
					let caught = false;

					try {
						await service1.query({
							eins: 1,
							zwei: 2,
							drei: 3,
							fier: 4
						}, ctx);

						const args = interface1.execute.getCall(0).args;

						expect(args[0].query)
						.to.deep.equal({
							eins: 1,
							zwei: 2
						});
					} catch(ex){
						caught = true;
					}

					expect(caught)
					.to.equal(true);
				});

				it('should be ok if no protected fields sent', async function(){
					await service1.query({
						eins: 1
					}, ctx);

					const args = interface1.execute.getCall(0).args;

					expect(args[0])
					.to.deep.equal({
						method: 'read',
						models: [{
							name: 'service-1',
							schema: 'service-1',
							fields: [{
								path: 'zwei'
							}, {
								path: 'drei'
							}],
							query: {
								eins: 1
							}
						}]
					});
				});
			});
		});

		describe('with blanket acceptance', function(){
			beforeEach(function(){
				ctx.hasPermission = () => true;
			});

			describe('create', function(){
				it('should prune fields', async function(){
					await service1.create({
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.execute.getCall(0).args;

					expect(args[0].payload)
					.to.deep.equal({
						eins: 1,
						zwei: 2,
						fier: 4
					});
				});
			});

			describe('update', function(){
				it('should prune fields', async function(){
					await service1.update(1, {
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.execute.getCall(1).args;
					
					expect(args[0].payload)
					.to.deep.equal({
						eins: 1,
						zwei: 2,
						fier: 4
					});
				});
			});

			describe('query', function(){
				it('should prune fields', async function(){
					await service1.query({
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.execute.getCall(0).args;
					
					expect(args[0])
					.to.deep.equal({
						method: 'read',
						models: [{
							name: 'service-1',
							schema: 'service-1',
							fields: [{
								path: 'zwei'
							}, {
								path: 'drei'
							}],
							query: {
								eins: 1,
								fier: 4
							}
						}]
					});
				});
			});
		});

		describe('with blanket acceptance', function(){
			let check = null;

			beforeEach(function(){
				ctx.hasPermission = (permission) => check(permission);
			});

			describe('create', function(){
				it('should allow fields with permission', async function(){
					check = (permission) => permission === 'can-create';

					await service1.create({
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.execute.getCall(0).args;

					expect(args[0].payload)
					.to.deep.equal({
						eins: 1,
						zwei: 2,
						fier: 4
					});
				});

				it('should prune fields without permission', async function(){
					check = (permission) => permission === 'no-create';

					await service1.create({
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.execute.getCall(0).args;

					expect(args[0].payload)
					.to.deep.equal({
						eins: 1,
						zwei: 2
					});
				});
			});
			
			describe('update', function(){
				it('should allow fields with permission', async function(){
					check = (permission) => permission === 'can-update';

					await service1.update(1, {
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.execute.getCall(1).args;
					
					expect(args[0].payload)
					.to.deep.equal({
						eins: 1,
						zwei: 2,
						fier: 4
					});
				});

				it('should prune fields without permission', async function(){
					check = (permission) => permission === 'no-create';

					await service1.create({
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.execute.getCall(0).args;

					expect(args[0].payload)
					.to.deep.equal({
						eins: 1,
						zwei: 2
					});
				});
			});

			describe('query', function(){
				it('should allow fields with permission', async function(){
					check = (permission) => permission === 'can-query';

					await service1.query({
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.execute.getCall(0).args;
					
					expect(args[0])
					.to.deep.equal({
						method: 'read',
						models: [{
							name: 'service-1',
							schema: 'service-1',
							fields: [{
								path: 'zwei'
							}, {
								path: 'drei'
							}],
							query: {
								eins: 1,
								fier: 4
							}
						}]
					});
				});

				it('should prune fields without permission', async function(){
					let failed = false;

					check = (permission) => permission === 'no-query';

					try {
						await service1.query({
							eins: 1,
							zwei: 2,
							drei: 3,
							fier: 4
						}, ctx);

						const args = interface1.execute.getCall(0).args;

						expect(args[0].payload)
						.to.deep.equal({
							eins: 1,
							zwei: 2
						});
					} catch(ex){
						failed = true;
					}

					expect(failed)
					.to.equal(true);
				});
			});
		});
	});

	describe('::install', function(){
		const loader = require('../server/loader.js');
		const {Config} = require('bmoor/src/lib/config.js');

		let ctx = null;
		let trace = null;
		let service = null;
		let permissions =  null;

		beforeEach(async function(){
			trace = [];
			permissions = {};

			stubs.execute = sinon.stub();

			ctx = new Context({
				method: '',
				permissions
			});

			const cfg = new Config({
				connectors: {
					'http': () => ({
						execute: stubs.execute
					})
				},
				crud: {
					model: 'model-dir',
					decorator: 'decorator-dir',
					hook: 'hook-dir',
					effect: 'effect-dir',
					composite: 'comp-dir'
				}
			});

			stubs.getFile = sinon.stub(loader, 'getFiles');

			// models
			stubs.getFile.onCall(0)
			.resolves([{
				name: 'service-1',
				path: 'model-path-1'
			},{
				name: 'service-2',
				path: 'model-path-2'
			}]);

			// composites
			stubs.getFile.onCall(1)
			.resolves([]);

			// decorators
			stubs.getFile.onCall(2)
			.resolves([{
				name: 'service-1',
				path: 'decorator-path-1'
			}]);

			// hooks
			stubs.getFile.onCall(3)
			.resolves([{
				name: 'service-1',
				path: 'hook-path-1'
			}]);

			// actions
			stubs.getFile.onCall(4)
			.resolves([{
				name: 'service-1',
				path: 'action-path-1'
			}]);

			// this overloads what settings are returned
			// for tests below.  So service-1 is not real
			stubs.getSettings = sinon.stub(loader, 'getSettings');
			
			stubs.getSettings.withArgs('model-path-1')
			.resolves({
				connector: 'http',
				fields: {
					id: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					name: true
				},
				security: {
					filter: 'can-read'
				}
			});

			stubs.getSettings.withArgs('model-path-2')
			.resolves({
				connector: 'http',
				fields: {
					id: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					name: true
				}
			});

			stubs.getSettings.withArgs('decorator-path-1')
			.resolves({
				hello: function(){
					expect(this.create)
					.to.not.equal(undefined);

					return 'world';
				}
			});

			stubs.getSettings.withArgs('hook-path-1')
			.resolves({
				afterCreate: async function(){
					trace.push(1);
				}
			});

			stubs.action = sinon.stub();
			stubs.getSettings.withArgs('action-path-1')
			.resolves([{
				model: 'service-2',
				action: 'update',
				callback: stubs.action
			}]);

			await forge.install(cfg.sub('connectors'), cfg.sub('crud'));

			// this method is not real
			service = await nexus.loadService('service-1');
		});

		it('should properly define the models', function(){
			expect(service.structure.fields.length)
			.to.equal(2);

			expect(service.structure.fields[0].path)
			.to.equal('id');
			
			expect(service.structure.fields[1].path)
			.to.equal('name');
		});

		describe('the service', function(){
			it('should correctly run create', async function(){
				stubs.execute.resolves([{
					name: 'something',
					junk: 'value'
				}]);

				const res = await service.create(
					{foo:'bar2', eins: 1}, 
					ctx
				);

				expect(res)
				.to.deep.equal({name: 'something'});
			});
		});

		it('should properly apply the security', async function(){
			it('should correctly run read', async function(){
				permissions['can-read'] = true;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				const res = await service.read(1, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});
			});

			it('should fail to run read without correct permissions', async function(){
				permissions['can-read'] = false;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				let failed = false;
				try {
					const res = await service.read(1, ctx);

					expect(res)
					.to.deep.equal({foo: 'bar'});
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should correctly run update', async function(){
				permissions['can-read'] = true;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				const res = await service.update(12, {eins: 1}, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});
			});

			it('should fail to run update without correct permissions', async function(){
				permissions['can-read'] = false;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				let failed = false;
				try {
					const res = await service.update(12, {}, ctx);

					expect(res)
					.to.deep.equal({foo: 'bar'});
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should correctly run delete', async function(){
				permissions['can-read'] = true;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				const res = await service.delete(12, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});
			});

			it('should fail to run delete without correct permissions', async function(){
				permissions['can-read'] = false;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				let failed = false;
				try {
					const res = await service.delete(12, ctx);

					expect(res)
					.to.deep.equal({foo: 'bar'});
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed)
				.to.equal(true);
			});
		});

		it('should properly apply the decorator', async function(){
			expect(service.hello())
			.to.equal('world');
		});

		it('should properly apply the hooks', async function(){
			it('should correctly run create', async function(){
				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				const res = await service.create({eins: 1}, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});

				expect(trace)
				.to.deep.equal([1]);
			});
		});

		it('should properly apply the actions', async function(){
			permissions['can-read'] = true;

			stubs.execute.resolves([{
				foo: 'bar'
			}]);
			//--------- for the update

			const otherService = await nexus.loadService('service-2');

			let called = false;

			stubs.action.callsFake(function(myService, from, to, myCtx){
				called = true;

				expect(service)
				.to.equal(myService);

				expect(ctx)
				.to.equal(myCtx);
			});

			await otherService.update(13, {name: 'ok'}, ctx);

			expect(called)
			.to.equal(true);
		});
	});

	describe('stubbed', function(){
		const loader = require('../server/loader.js');
		const {Config} = require('bmoor/src/lib/config.js');

		let ctx = null;
		let trace = null;
		let service = null;
		let permissions =  null;

		beforeEach(async function(){
			trace = [];
			permissions = {};

			stubs.execute = sinon.stub();

			ctx = new Context({
				method: '',
				permissions
			});

			const mockery = new Config();
			const cfg = new Config({
				connectors: {
					'http': () => ({
						execute: stubs.execute
					})
				},
				crud: {
					model: 'model-dir',
					decorator: 'decorator-dir',
					hook: 'hook-dir',
					effect: 'effect-dir',
					composite: 'comp-dir'
				}
			});

			stubs.getFile = sinon.stub(loader, 'getFiles');

			// models
			mockery.set('model', [{
				name: 'service-1',
				path: 'model-path-1',
				settings: {
					connector: 'http',
					fields: {
						id: {
							create: false,
							read: true,
							update: false,
							delete: true,
							key: true
						},
						name: true
					},
					security: {
						filter: 'can-read'
					}
				}
			},{
				name: 'service-2',
				path: 'model-path-2',
				settings: {
					connector: 'http',
					fields: {
						id: {
							create: false,
							read: true,
							update: false,
							delete: true,
							key: true
						},
						name: true
					}
				}
			}]);

			// composites
			mockery.set('composite', []);

			// decorators
			mockery.set('decorator', [{
				name: 'service-1',
				path: 'decorator-path-1',
				settings: {
					hello: function(){
						expect(this.create)
						.to.not.equal(undefined);

						return 'world';
					}
				}
			}]);

			// hooks
			mockery.set('hook', [{
				name: 'service-1',
				path: 'hook-path-1',
				settings: {
					afterCreate: async function(){
						trace.push(1);
					}
				}
			}]);

			// actions
			stubs.action = sinon.stub();
			mockery.set('effect', [{
				name: 'service-1',
				path: 'action-path-1',
				settings: [{
					model: 'service-2',
					action: 'update',
					callback: stubs.action
				}]
			}]);

			await forge.install(cfg.sub('connectors'), cfg.sub('crud'), mockery);

			// this method is not real
			service = await nexus.loadService('service-1');
		});

		it('should properly define the models', function(){
			expect(service.structure.fields.length)
			.to.equal(2);

			expect(service.structure.fields[0].path)
			.to.equal('id');
			
			expect(service.structure.fields[1].path)
			.to.equal('name');
		});

		describe('the service', function(){
			it('should correctly run create', async function(){
				stubs.execute.resolves([{
					name: 'something',
					junk: 'value'
				}]);

				const res = await service.create(
					{foo:'bar2', eins: 1}, 
					ctx
				);

				expect(res)
				.to.deep.equal({name: 'something'});
			});
		});

		it('should properly apply the security', async function(){
			it('should correctly run read', async function(){
				permissions['can-read'] = true;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				const res = await service.read(1, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});
			});

			it('should fail to run read without correct permissions', async function(){
				permissions['can-read'] = false;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				let failed = false;
				try {
					const res = await service.read(1, ctx);

					expect(res)
					.to.deep.equal({foo: 'bar'});
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should correctly run update', async function(){
				permissions['can-read'] = true;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				const res = await service.update(12, {eins: 1}, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});
			});

			it('should fail to run update without correct permissions', async function(){
				permissions['can-read'] = false;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				let failed = false;
				try {
					const res = await service.update(12, {}, ctx);

					expect(res)
					.to.deep.equal({foo: 'bar'});
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should correctly run delete', async function(){
				permissions['can-read'] = true;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				const res = await service.delete(12, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});
			});

			it('should fail to run delete without correct permissions', async function(){
				permissions['can-read'] = false;

				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				let failed = false;
				try {
					const res = await service.delete(12, ctx);

					expect(res)
					.to.deep.equal({foo: 'bar'});
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed)
				.to.equal(true);
			});
		});

		it('should properly apply the decorator', async function(){
			expect(service.hello())
			.to.equal('world');
		});

		it('should properly apply the hooks', async function(){
			it('should correctly run create', async function(){
				stubs.execute.resolves([{
					foo: 'bar'
				}]);

				const res = await service.create({eins: 1}, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});

				expect(trace)
				.to.deep.equal([1]);
			});
		});

		it('should properly apply the actions', async function(){
			permissions['can-read'] = true;

			stubs.execute.resolves([{
				foo: 'bar'
			}]);
			//--------- for the update

			const otherService = await nexus.loadService('service-2');

			let called = false;

			stubs.action.callsFake(function(myService, from, to, myCtx){
				called = true;

				expect(service)
				.to.equal(myService);

				expect(ctx)
				.to.equal(myCtx);
			});

			await otherService.update(13, {name: 'ok'}, ctx);

			expect(called)
			.to.equal(true);
		});
	});
});
