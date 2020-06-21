
const {expect} = require('chai');
const sinon = require('sinon');

const {Bus} = require('./bus.js');
const {Nexus} = require('./nexus.js');
const {Context} = require('./context.js');

const sut = require('./forge.js');

describe('src/forge.js', function(){
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
		.forEach(stub => stub.restore());
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

			nexus.setModel('service-2', {
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

			interface1 = {};
			interface2 = {};

			service1 = await nexus.installService('service-1', interface1);
			service2 = await nexus.installService('service-2', interface2);
		});

		describe('::configure', function(){
			it('should allow for the subscription of afterCreate events', async function(){
				interface1.prepare = () => Promise.resolve('foo-bar');
				interface1.execute = () => Promise.resolve([{
					foo: 'bar'
				}]);

				bus.broadcast.on('service-1.create', function(datum, myCtx){
					expect(datum)
					.to.deep.equal({foo: 'bar'});

					expect(ctx)
					.to.equal(myCtx);

					myCtx.addChange('foo', 'bar', {hello: 'world'});
				});

				await forge.configure('service-1');

				const res = await service1.create({eins: 1}, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});

				expect(ctx.getChanges())
				.to.deep.equal({
					'service-1': [{
						action: 'create',
						datum: {foo: 'bar'}
					}],
					'foo': [{
						action: 'bar',
						datum: {hello: 'world'}
					}]
				});
			});

			it('should allow for the subscription of afterUpdate events', async function(){
				interface1.prepare = () => Promise.resolve('foo-bar');
				interface1.execute = () => Promise.resolve([{
					foo: 'bar'
				}]);

				bus.broadcast.on('service-1.update', function(datum, myCtx){
					expect(datum)
					.to.deep.equal({foo: 'bar'});

					expect(ctx)
					.to.equal(myCtx);

					myCtx.addChange('foo', 'bar', {hello: 'world'});
				});

				await forge.configure('service-1');

				const res = await service1.update(1, {eins: 1}, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});

				expect(ctx.getChanges())
				.to.deep.equal({
					'service-1': [{
						action: 'update',
						datum: {foo: 'bar'}
					}],
					'foo': [{
						action: 'bar',
						datum: {hello: 'world'}
					}]
				});
			});

			it('should allow for the subscription of afterDelete events', async function(){
				interface1.prepare = () => Promise.resolve('foo-bar');
				interface1.execute = () => Promise.resolve([{
					foo: 'bar'
				}]);

				bus.broadcast.on('service-1.delete', function(datum, myCtx){
					expect(datum)
					.to.deep.equal({foo: 'bar'});

					expect(ctx)
					.to.equal(myCtx);

					myCtx.addChange('foo', 'bar', {hello: 'world'});
				});

				await forge.configure('service-1');

				const res = await service1.delete(1, ctx);

				expect(res)
				.to.deep.equal({foo: 'bar'});

				expect(ctx.getChanges())
				.to.deep.equal({
					'service-1': [{
						action: 'delete',
						datum: {foo: 'bar'}
					}],
					'foo': [{
						action: 'bar',
						datum: {hello: 'world'}
					}]
				});
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

		describe('::configure should play nice with ::subscribe', function(){
			it('should work for create', async function(){
				interface1.prepare = () => Promise.resolve('foo-bar');
				interface1.execute = () => Promise.resolve([{
					foo: 'bar'
				}]);

				interface2.prepare = () => Promise.resolve('hello-world');
				interface2.execute = () => Promise.resolve([{
					hello: 'world'
				}]);

				await forge.configure('service-1');

				await forge.subscribe('service-2', [{
					model: 'service-1',
					action: 'create',
					callback: function(service, datum, myCtx){
						expect(service)
						.to.equal(service2);

						expect(datum)
						.to.deep.equal({foo: 'bar'});

						return service.create({'this-is': 'junk'}, myCtx);
					}
				}]);

				await service1.create({eins: 1}, ctx);

				expect(ctx.getChanges())
				.to.deep.equal({
					'service-1': [{
						action: 'create',
						datum: {foo: 'bar'}
					}],
					'service-2': [{
						action: 'create',
						datum: {hello: 'world'}
					}]
				});
			});

			it('should work for update', async function(){
				interface1.prepare = () => Promise.resolve('foo-bar');
				interface1.execute = () => Promise.resolve([{
					foo: 'bar'
				}]);

				interface2.prepare = () => Promise.resolve('hello-world');
				interface2.execute = () => Promise.resolve([{
					hello: 'world'
				}]);

				await forge.configure('service-1');

				await forge.subscribe('service-2', [{
					model: 'service-1',
					action: 'update',
					callback: function(service, datum, myCtx){
						expect(service)
						.to.equal(service2);

						expect(datum)
						.to.deep.equal({foo: 'bar'});

						return service.create({'this-is': 'junk'}, myCtx);
					}
				}]);

				await service1.update(1, {eins: 1}, ctx);

				expect(ctx.getChanges())
				.to.deep.equal({
					'service-1': [{
						action: 'update',
						datum: {foo: 'bar'}
					}],
					'service-2': [{
						action: 'create',
						datum: {hello: 'world'}
					}]
				});
			});

			it('should work for delete', async function(){
				interface1.prepare = () => Promise.resolve('foo-bar');
				interface1.execute = () => Promise.resolve([{
					foo: 'bar'
				}]);

				interface2.prepare = () => Promise.resolve('hello-world');
				interface2.execute = () => Promise.resolve([{
					hello: 'world'
				}]);

				await forge.configure('service-1');

				await forge.subscribe('service-2', [{
					model: 'service-1',
					action: 'delete',
					callback: function(service, datum, myCtx){
						expect(service)
						.to.equal(service2);

						expect(datum)
						.to.deep.equal({foo: 'bar'});

						return service.create({'this-is': 'junk'}, myCtx);
					}
				}]);

				await service1.delete(1, ctx);

				expect(ctx.getChanges())
				.to.deep.equal({
					'service-1': [{
						action: 'delete',
						datum: {foo: 'bar'}
					}],
					'service-2': [{
						action: 'create',
						datum: {hello: 'world'}
					}]
				});
			});
		});
	});

	describe('::secure', function(){
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
				prepare: sinon.stub().resolves('foo-bar'),
				execute: () => Promise.resolve([{foo: 'bar'}])
			};

			service1 = await nexus.installService('service-1', interface1);

			await forge.secure('service-1');
		});

		describe('with blanket rejection', function(){
			beforeEach(function(){
				ctx.hasPermission = () => Promise.resolve(false);
			});

			describe('create', function(){
				it('should prune fields', async function(){
					await service1.create({
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.prepare.getCall(0).args;

					expect(args[0].delta)
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

					const args = interface1.prepare.getCall(1).args;
					
					expect(args[0].delta)
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

						const args = interface1.prepare.getCall(0).args;

						expect(args[0].context)
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

					const args = interface1.prepare.getCall(0).args;

					expect(args[0].context)
					.to.deep.equal({
						eins: 1
					});
				});
			});
		});

		describe('with blanket acceptance', function(){
			beforeEach(function(){
				ctx.hasPermission = () => Promise.resolve(true);
			});

			describe('create', function(){
				it('should prune fields', async function(){
					await service1.create({
						eins: 1,
						zwei: 2,
						drei: 3,
						fier: 4
					}, ctx);

					const args = interface1.prepare.getCall(0).args;

					expect(args[0].delta)
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

					const args = interface1.prepare.getCall(1).args;
					
					expect(args[0].delta)
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

					const args = interface1.prepare.getCall(0).args;
					
					expect(args[0].context)
					.to.deep.equal({
						eins: 1,
						fier: 4
					});
				});
			});
		});

		describe('with blanket acceptance', function(){
			let check = null;

			beforeEach(function(){
				ctx.hasPermission = (permission) => Promise.resolve(check(permission));
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

					const args = interface1.prepare.getCall(0).args;

					expect(args[0].delta)
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

					const args = interface1.prepare.getCall(0).args;

					expect(args[0].delta)
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

					const args = interface1.prepare.getCall(1).args;
					
					expect(args[0].delta)
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

					const args = interface1.prepare.getCall(0).args;

					expect(args[0].delta)
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

					const args = interface1.prepare.getCall(0).args;
					
					expect(args[0].context)
					.to.deep.equal({
						eins: 1,
						fier: 4
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

						const args = interface1.prepare.getCall(0).args;

						expect(args[0].delta)
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
});
