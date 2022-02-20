
const {expect} = require('chai');
const sinon = require('sinon');
const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const sut = require('./server.js');

describe('src/server.js', function(){
	let app = null;
	let stubs = null;
	let server = null;
	let bootstrap = null;

	beforeEach(async function(){
		stubs = {
		};

		app = express();

		app.use(bodyParser.urlencoded({ extended: false }));
		app.use(bodyParser.json());

		const cfg = sut.config.extend({
			connectors: {
				'http': () => ({
					execute: stubs.execute
				})
			},
			directories: {
				model: '/models',
				decorator: '/decorators',
				hook: '/hooks',
				effect: '/effects',
				composite: '/composites',
				guard: '/guards',
				action: '/actions',
				utility: '/utilities',
				document: '/documents'
			}
		});

		const mockery = cfg.sub('stubs');

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
					name: true,
					link: {
						name: 'service-1',
						field: 'id'
					}
				}
			}
		}]);

		// composites
		mockery.set('composite', [{
			name: 'composite-1',
			settings: {
				base: 'service-1',
				key: 'id',
				connector: 'http',
				fields: {
					'id': '.id',
					'name': '.name',
					'other': '> $service-2.name'
				}
			}
		}]);

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

		const trace = [];
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

		mockery.set('guard', [{
			name: 'service-1',
			settings: {
				read: true,
				query: true,
				create: true,
				update: true,
				delete: true
			}
		}]);

		mockery.set('action', [{
			name: 'service-1',
			settings: {
				hello: {
					method: 'get'
				}
			}
		}]);

		mockery.set('utility', [{
			name: 'service-1',
			settings: {
				hello: {
					method: 'get'
				}
			}
		}]);

		mockery.set('synthetic', [{
			name: 'composite-1',
			settings: {
				readable: true
				// read: 'can-read'
			}
		}]);

		bootstrap = await sut.configure(cfg);

		sut.build(bootstrap, app);

		return new Promise((resolve) => {
			server = app.listen(3000, resolve);
		});
	});

	afterEach(async function(){
		for(let key in stubs){
			if (stubs[key].restore){
				stubs[key].restore();
			}
		}

		return new Promise((resolve) => {
			server.close(resolve);
		});
	});

	describe('/crud/service-1', function(){
		describe('method:post', function(){
			describe('/bmoor/crud/service-1', function(){
				it('should work', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.create = sinon.stub(service, 'create')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/crud/service-1', {
							method: 'post',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({foo: 'bar'})
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: {
							hello: 'world'
						}
					});

					expect(stubs.create.getCall(0).args[0])
					.to.deep.equal({
						foo: 'bar'
					});
				});
			});
		});

		describe('method:get', function(){
			describe('/bmoor/crud/service-1/:id', function(){
				it('should work with a singular', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.read = sinon.stub(service, 'read')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/crud/service-1/1234', {
							method: 'get',
							headers: { 'Content-Type': 'application/json' }
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: {
							hello: 'world'
						}
					});

					expect(stubs.read.getCall(0).args[0])
					.to.deep.equal('1234');
				});

				it('should work with a singular', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.readMany = sinon.stub(service, 'readMany')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/crud/service-1/12,34', {
							method: 'get',
							headers: { 'Content-Type': 'application/json' }
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: {
							hello: 'world'
						}
					});

					expect(stubs.readMany.getCall(0).args[0])
					.to.deep.equal(['12','34']);
				});
			});


			describe('/bmoor/crud/service-1', function(){
				xit('should allow queries', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.query = sinon.stub(service, 'query')
					.resolves([{hello: 'world'}]);

					const url = 'http://localhost:3000/bmoor/crud/service-1' +
						'?filter[foo]=bar&filter[id][gt]=1000&filter[id][lt]=1500' +
						'&sort=-bar,+id' +
						'&join[.id$service-2 > service-1]=20';

					// join to base models like composites... where to put logic?
					// TODO: pagination

					const res = await (await fetch(
						url, {
							method: 'get',
							headers: { 'Content-Type': 'application/json' }
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: [{
							hello: 'world'
						}]
					});

					expect(stubs.query.getCall(0).args[0])
					.to.deep.equal({
						foo: 'bar',
						'hello.world': 'eins'
					});
				});

				it('should allow all', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.readAll = sinon.stub(service, 'readAll')
					.resolves([{hello: 'world'}]);

					const res = await (await fetch(
						'http://localhost:3000/bmoor/crud/service-1', {
							method: 'get',
							headers: { 'Content-Type': 'application/json' }
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: [{
							hello: 'world'
						}]
					});

					expect(stubs.readAll.getCall(0).args[0].toJSON())
					.to.deep.equal({
						content: {},
						method: 'get',
						params: {},
						permissions: {},
						query: {}
					});
				});
			});

			describe('/bmoor/action/service-1/hello/:id', function(){
				it('should call correctly', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.read = sinon.stub(service, 'read')
					.resolves({a: 'datum'});

					stubs.hello = sinon.stub(service, 'hello')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/action/service-1/hello/123', {
							method: 'get',
							headers: { 'Content-Type': 'application/json' }
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: {
							hello: 'world'
						}
					});

					expect(stubs.hello.getCall(0).args[0])
					.to.deep.equal({
						a: 'datum'
					});
				});
			});


			describe('/bmoor/utility/service-1/hello', function(){
				it('should call correctly', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.hello = sinon.stub(service, 'hello')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/utility/service-1/hello', {
							method: 'get',
							headers: { 'Content-Type': 'application/json' }
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: {
							hello: 'world'
						}
					});

					expect(stubs.hello.getCall(0).args[0].toJSON())
					.to.deep.equal({
						content: {},
						method: 'get',
						params: {
							utility: 'hello'
						},
						permissions: {},
						query: {}
					});
				});
			});

			describe('/bmoor/synthetic/composite-1/:id', function(){
				it('should work', async function(){
					const service = bootstrap.nexus.getDocument('composite-1');

					stubs.read = sinon.stub(service, 'read')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/synthetic/composite-1/1234', {
							method: 'get',
							headers: {'Content-Type': 'application/json'}
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: {
							hello: 'world'
						}
					});

					expect(stubs.read.getCall(0).args[0])
					.to.deep.equal('1234');
				});
			});


			describe('/bmoor/synthetic/composite-1', function(){
				it('should work', async function(){
					const service = bootstrap.nexus.getDocument('composite-1');

					stubs.query = sinon.stub(service, 'query')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/synthetic/composite-1?foo=bar', {
							method: 'get',
							headers: { 'Content-Type': 'application/json' }
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: {
							hello: 'world'
						}
					});

					expect(stubs.query.getCall(0).args[0])
					.to.deep.equal({
						foo: 'bar'
					});
				});
			});
		});

		describe('method:delete', function(){
			describe('/bmoor/crud/service-1/:id', function(){
				it('it should work', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.delete = sinon.stub(service, 'delete')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/crud/service-1/1234', {
							method: 'delete',
							headers: { 'Content-Type': 'application/json' }
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: {
							hello: 'world'
						}
					});

					expect(stubs.delete.getCall(0).args[0])
					.to.deep.equal('1234');
				});
			});


			describe('/bmoor/crud/service-1', function(){
				it('is should work', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.query = sinon.stub(service, 'query')
					.resolves([{id: 'zwei'}]);

					stubs.delete = sinon.stub(service, 'delete')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/crud/service-1?foo=bar', {
							method: 'delete',
							headers: { 'Content-Type': 'application/json' }
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: [{
							hello: 'world'
						}]
					});

					expect(stubs.query.getCall(0).args[0])
					.to.deep.equal({
						foo: 'bar'
					});

					expect(stubs.delete.getCall(0).args[0])
					.to.deep.equal('zwei');
				});
			});
		});

		describe('method:put', function(){
			describe('/bmoor/crud/service-1/:id', function(){
				it('should work', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.update = sinon.stub(service, 'update')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/crud/service-1/1234', {
							method: 'put',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({foo: 'bar'})
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: {
							hello: 'world'
						}
					});

					expect(stubs.update.getCall(0).args[0])
					.to.deep.equal('1234');
				});
			});
		});

		describe('method:patch', function(){
			describe('/bmoor/crud/service-1/:id', function(){
				it('should work', async function(){
					const service = bootstrap.nexus.getCrud('service-1');

					stubs.update = sinon.stub(service, 'update')
					.resolves({hello: 'world'});

					const res = await (await fetch(
						'http://localhost:3000/bmoor/crud/service-1/1234', {
							method: 'patch',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({foo: 'bar'})
						}
					)).json();

					expect(res)
					.to.deep.equal({
						result: {
							hello: 'world'
						}
					});

					expect(stubs.update.getCall(0).args[0])
					.to.deep.equal('1234');
				});
			});
		});
	});
});
