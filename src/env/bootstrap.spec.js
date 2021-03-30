
const {expect} = require('chai');
const sinon = require('sinon');

const sut = require('./bootstrap.js');

describe('src/env/bootstrap.js', function(){
	let stubs = null;
	let stubbedNexus = null;

	beforeEach(function(){
		stubs = {
		};

		stubbedNexus = {
		};
	});

	afterEach(function(){
		for(let key in stubs){
			if (stubs[key].restore){
				stubs[key].restore();
			}
		}
	});

	it('should load everything correctly', async function(){
		stubs.execute = sinon.stub();

		/*
		ctx = new Context({
			method: '',
			permissions
		});
		*/ 

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
			name: 'service-1',
			settings: {
				read: 'can-read'
			}
		}]);

		const bootstrap = new sut.Bootstrap(cfg);

		await bootstrap.install();
	});
});