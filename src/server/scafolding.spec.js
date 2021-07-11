
const {expect} = require('chai');
const sinon = require('sinon');

const sut = require('./scafolding.js');

describe('src/server/scafolding.js', function(){
	let cfg = null;
	let app = null;
	let stubs = null;
	let mockery = null;
	let bootstrap = null;

	beforeEach(function(){
		stubs = {};

		stubs.routerUse = sinon.stub();
		stubs.routerGet = sinon.stub();
		stubs.routerPut = sinon.stub();
		stubs.routerPost = sinon.stub();
		stubs.routerPatch = sinon.stub();
		stubs.routerDelete = sinon.stub();

		cfg = sut.config.extend({
			connectors: {
				'http': () => ({
					execute: stubs.execute
				})
			},
			directories: {
				models: '/models',
				decorators: '/decorators',
				hooks: '/hooks',
				effects: '/effects',
				composites: '/composites',
				guards: '/guards',
				actions: '/actions',
				utilities: '/utilities',
				synthetics: '/documents'
			},
			server: {
				buildRouter: () => ({
					use: stubs.routerUse,
					get: stubs.routerGet,
					put: stubs.routerPut,
					post: stubs.routerPost,
					patch: stubs.routerPatch,
					delete: stubs.routerDelete
				})
			}
		});

		mockery = cfg.sub('stubs');

		mockery.set('cruds', [{
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
					service1Id: {
						link: {
							name: 'service-1',
							field: 'id'
						}
					}
				}
			}
		}]);

		// composites
		mockery.set('documents', [{
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
		mockery.set('decorators', [{
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
		mockery.set('hooks', [{
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
		mockery.set('effects', [{
			name: 'service-1',
			path: 'action-path-1',
			settings: [{
				model: 'service-2',
				action: 'update',
				callback: stubs.action
			}]
		}]);

		mockery.set('guards', [{
			name: 'service-1',
			settings: {
				read: true,
				query: true,
				create: true,
				update: true,
				delete: true
			}
		}]);

		mockery.set('actions', [{
			name: 'service-1',
			settings: {
				hello: {
					method: 'get'
				}
			}
		}]);

		mockery.set('utilities', [{
			name: 'service-1',
			settings: {
				hello: {
					method: 'get'
				}
			}
		}]);

		mockery.set('synthetics', [{
			name: 'composite-1',
			settings: {
				readable: true
				// read: 'can-read'
			}
		}]);
	});

	it('should build correctly', async function(){
		stubs.appUse = sinon.stub();

		app = {
			use: stubs.appUse
		};

		bootstrap = await sut.build(app, cfg, mockery);

		expect(stubs.appUse.callCount)
		.to.equal(1);

		expect(stubs.routerUse.callCount)
		.to.equal(8);

		expect(stubs.routerGet.callCount)
		.to.equal(6);

		expect(stubs.routerPut.callCount)
		.to.equal(1);

		expect(stubs.routerPost.callCount)
		.to.equal(1);

		expect(stubs.routerPatch.callCount)
		.to.equal(1);

		expect(stubs.routerDelete.callCount)
		.to.equal(2);
	});

	it('should fail to build if unable to connect models', async function(){
		mockery.settings.cruds.push({
			name: 'service-3',
			path: 'model-path-3',
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
		});

		mockery.settings.documents.push({
			name: 'composite-2',
			settings: {
				base: 'service-1',
				key: 'id',
				connector: 'http',
				fields: {
					'id': '.id',
					'name': '.name',
					'other': '> $service-3.name'
				}
			}
		});

		mockery.settings.synthetics.push({
			name: 'composite-2',
			settings: {
				readable: true
				// read: 'can-read'
			}
		});

		let failed = false;

		try {
			stubs.appUse = sinon.stub();

			app = {
				use: stubs.appUse
			};

			bootstrap = await sut.build(app, cfg, mockery);
		} catch(ex){
			failed = true;
		}

		expect(failed)
		.to.equal(true);
	});
});
