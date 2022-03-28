const sinon = require('sinon');
const {expect} = require('chai');
const {Config, ConfigObject} = require('bmoor/src/lib/config.js');

const sut = require('./scafolding.js');

describe('src/server/scafolding.js', function () {
	let cfg = null;
	let app = null;
	let stubs = null;
	let mockery = null;

	beforeEach(function () {
		stubs = {};

		stubs.routerUse = sinon.stub();
		stubs.routerGet = sinon.stub();
		stubs.routerPut = sinon.stub();
		stubs.routerPost = sinon.stub();
		stubs.routerPatch = sinon.stub();
		stubs.routerDelete = sinon.stub();

		const bootstrap = sut.config.getSub('bootstrap').override(
			{},
			{
				connectors: new Config({
					http: () => ({
						execute: stubs.execute
					})
				}),
				sources: new Config({
					'test-1': new ConfigObject({
						connector: 'http'
					})
				}),
				directories: new Config({
					models: '/models',
					decorators: '/decorators',
					hooks: '/hooks',
					effects: '/effects',
					composites: '/composites',
					guards: '/guards',
					actions: '/actions',
					utilities: '/utilities',
					synthetics: '/documents'
				})
			}
		);

		cfg = sut.config.override(
			{},
			{
				bootstrap,
				server: new Config({
					buildRouter: () => ({
						use: stubs.routerUse,
						get: stubs.routerGet,
						put: stubs.routerPut,
						post: stubs.routerPost,
						patch: stubs.routerPatch,
						delete: stubs.routerDelete
					})
				})
			}
		);

		mockery = {};
		mockery.cruds = [
			{
				name: 'service-1',
				path: 'model-path-1',
				settings: {
					source: 'test-1',
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
			},
			{
				name: 'service-2',
				path: 'model-path-2',
				settings: {
					source: 'test-1',
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
			}
		];

		// composites
		mockery.documents = [
			{
				name: 'composite-1',
				settings: {
					base: 'service-1',
					joins: ['> $service-2'],
					connector: 'http',
					fields: {
						id: '.id',
						name: '.name',
						other: '$service-2.name'
					}
				}
			}
		];

		// decorators
		mockery.decorators = [
			{
				name: 'service-1',
				path: 'decorator-path-1',
				settings: {
					hello: function () {
						expect(this.create).to.not.equal(undefined);

						return 'world';
					}
				}
			}
		];

		const trace = [];
		// hooks
		mockery.hooks = [
			{
				name: 'service-1',
				path: 'hook-path-1',
				settings: {
					afterCreate: async function () {
						trace.push(1);
					}
				}
			}
		];

		// actions
		stubs.action = sinon.stub();
		mockery.effects = [
			{
				name: 'service-1',
				path: 'action-path-1',
				settings: [
					{
						model: 'service-2',
						action: 'update',
						callback: stubs.action
					}
				]
			}
		];

		mockery.guards = [
			{
				name: 'service-1',
				settings: {
					read: true,
					query: true,
					create: true,
					update: true,
					delete: true
				}
			}
		];

		mockery.actions = [
			{
				name: 'service-1',
				settings: {
					hello: {
						method: 'get'
					}
				}
			}
		];

		mockery.utilities = [
			{
				name: 'service-1',
				settings: {
					hello: {
						method: 'get'
					}
				}
			}
		];

		mockery.synthetics = [
			{
				name: 'composite-1',
				settings: {
					readable: true
					// read: 'can-read'
				}
			}
		];
	});

	it('should build correctly', async function () {
		stubs.appUse = sinon.stub();

		app = {
			use: stubs.appUse
		};

		await sut.build(app, cfg, mockery);

		expect(stubs.appUse.callCount).to.equal(1);

		expect(stubs.routerUse.callCount).to.equal(8);

		expect(stubs.routerGet.callCount).to.equal(6);

		expect(stubs.routerPut.callCount).to.equal(1);

		expect(stubs.routerPost.callCount).to.equal(1);

		expect(stubs.routerPatch.callCount).to.equal(2);

		expect(stubs.routerDelete.callCount).to.equal(2);
	});

	it('should fail to build if unable to connect models', async function () {
		mockery.cruds.push({
			name: 'service-3',
			path: 'model-path-3',
			settings: {
				source: 'test-1',
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

		mockery.documents.push({
			name: 'composite-2',
			settings: {
				base: 'service-1',
				joins: ['> $service-3'],
				connector: 'http',
				fields: {
					id: '.id',
					name: '.name',
					other: '$service-3.name'
				}
			}
		});

		mockery.synthetics.push({
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

			await sut.build(app, cfg, mockery);
		} catch (ex) {
			failed = true;

			expect(ex.message).to.equal(
				'composite composite-2: can not connect service-1 to service-3'
			);
		}

		expect(failed).to.equal(true);
	});
});
