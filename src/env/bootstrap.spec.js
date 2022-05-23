const {expect} = require('chai');
const sinon = require('sinon');
const {Config, ConfigObject} = require('bmoor/src/lib/config.js');

const sut = require('./bootstrap.js');

describe('src/env/bootstrap.js', function () {
	let stubs = null;

	beforeEach(function () {
		stubs = {};
	});

	afterEach(function () {
		for (let key in stubs) {
			if (stubs[key].restore) {
				stubs[key].restore();
			}
		}
	});

	describe('::install', function () {
		let bootstrap = null;

		beforeEach('should load everything correctly', async function () {
			stubs.execute = sinon.stub();

			const cfg = sut.config.override(
				{},
				{
					connectors: new Config({
						http: () => ({
							execute: stubs.execute
						})
					}),
					sources: new Config({
						's-1': new ConfigObject({
							connector: 'http'
						}),
						's-2': new ConfigObject({
							connector: 'http'
						})
					}),
					directories: new Config({
						// do not load any directories
					})
				}
			);

			bootstrap = new sut.Bootstrap(cfg);

			stubs.action = sinon.stub();

			const trace = [];

			const mockery = {
				cruds: [
					{
						name: 'service-1',
						settings: {
							source: 's-1',
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
					},
					{
						name: 'service-2',
						settings: {
							source: 's-2',
							fields: {
								id: {
									create: false,
									read: true,
									update: false,
									delete: true,
									key: true
								},
								name: {
									create: true,
									read: true,
									update: true,
									link: {
										name: 'service-1',
										field: 'id'
									}
								}
							}
						}
					}
				],
				documents: [
					{
						name: 'composite-1',
						settings: {
							base: 'service-1',
							joins: ['> $service-2'],
							fields: {
								id: '.id',
								name: '.name',
								other: '$service-2.name'
							}
						}
					}
				],
				decorators: [
					{
						name: 'service-1',
						settings: {
							hello: function () {
								expect(this.create).to.not.equal(undefined);

								return 'world';
							}
						}
					}
				],
				hooks: [
					{
						name: 'service-1',
						settings: {
							afterCreate: async function () {
								trace.push(1);
							}
						}
					}
				],
				effects: [
					{
						name: 'service-1',
						settings: [
							{
								model: 'service-2',
								action: 'update',
								callback: stubs.action
							}
						]
					}
				],
				guards: [
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
				],
				actions: [
					{
						name: 'service-1',
						settings: {
							hello: {
								method: 'get'
							}
						}
					}
				],
				utilities: [
					{
						name: 'service-1',
						settings: {
							hello: {
								method: 'get'
							}
						}
					}
				],
				synthetics: [
					{
						name: 'composite-1',
						settings: {
							read: 'can-read'
						}
					}
				]
			};

			await bootstrap.install(mockery);
		});

		it('should install correctly', async function () {
			const res = JSON.parse(JSON.stringify(bootstrap));

			expect(res.crud).to.deep.equal({
				services: [
					{
						$schema: 'bmoor-crud:view',
						structure: {
							$schema: 'bmoor-crud:structure',
							name: 'service-1',
							fields: [
								{
									path: 'id',
									storage: {
										schema: 'service-1',
										path: 'id'
									},
									usage: {}
								},
								{
									path: 'name',
									storage: {
										schema: 'service-1',
										path: 'name'
									},
									usage: {}
								}
							]
						}
					},
					{
						$schema: 'bmoor-crud:view',
						structure: {
							$schema: 'bmoor-crud:structure',
							name: 'service-2',
							fields: [
								{
									path: 'id',
									storage: {
										schema: 'service-2',
										path: 'id'
									},
									usage: {}
								},
								{
									path: 'name',
									storage: {
										schema: 'service-2',
										path: 'name'
									},
									usage: {}
								}
							]
						}
					}
				],
				documents: [
					{
						$schema: 'bmoor-crud:view',
						structure: {
							$schema: 'bmoor-crud:structure',
							name: 'composite-1',
							fields: [
								{
									path: 'id',
									storage: {
										schema: 'service-1',
										path: 'id'
									},
									usage: {}
								},
								{
									path: 'name',
									storage: {
										schema: 'service-1',
										path: 'name'
									},
									usage: {}
								},
								{
									path: 'other',
									storage: {
										schema: 'service-2',
										path: 'name'
									},
									usage: {}
								}
							]
						}
					}
				]
			});

			expect(res.controllers).to.deep.equal({
				guards: [
					{
						$schema: 'bmoor-crud:controller',
						routes: [
							{
								route: {
									path: '',
									method: 'post'
								},
								structure: 'service-1'
							},
							{
								route: {
									path: '/:id',
									method: 'get'
								},
								structure: 'service-1'
							},
							{
								route: {
									path: '',
									method: 'get'
								},
								structure: 'service-1'
							},
							{
								route: {
									path: '/:id',
									method: 'put'
								},
								structure: 'service-1'
							},
							{
								route: {
									path: '/:id',
									method: 'patch'
								},
								structure: 'service-1'
							},
							{
								route: {
									path: '',
									method: 'patch'
								},
								structure: 'service-1'
							},
							{
								route: {
									path: '/:id',
									method: 'delete'
								},
								structure: 'service-1'
							},
							{
								route: {
									path: '',
									method: 'delete'
								},
								structure: 'service-1'
							}
						]
					}
				],
				actions: [
					{
						$schema: 'bmoor-crud:controller',
						routes: [
							{
								route: {
									method: 'get',
									path: '/hello/:id'
								},
								structure: 'service-1'
							}
						]
					}
				],
				utilities: [
					{
						$schema: 'bmoor-crud:controller',
						routes: [
							{
								route: {
									method: 'get',
									path: '/hello'
								},
								structure: 'service-1'
							}
						]
					}
				],
				synthetics: [
					{
						$schema: 'bmoor-crud:controller',
						routes: [
							/*{
						'route': {
							'path': '',
							'method': 'post'
						},
						'structure': 'composite-1'
					}, */ {
								route: {
									path: '/:id',
									method: 'get'
								},
								structure: 'composite-1'
							},
							{
								route: {
									path: '',
									method: 'get'
								},
								structure: 'composite-1'
							}
						]
					}
				],
				querier: {
					$schema: 'bmoor-crud:controller',
					routes: [
						{
							route: {
								path: '',
								method: 'post'
							}
						},
						{
							route: {
								path: '/:type/:name',
								method: 'get'
							}
						}
					]
				}
			});

			expect(res.router).to.deep.equal({
				$schema: 'bmoor-crud:router',
				path: '/bmoor',
				routes: [
					{
						$schema: 'bmoor-crud:router',
						path: '/action',
						routes: [
							{
								$schema: 'bmoor-crud:router',
								path: '/service-1',
								routes: [
									{
										$schema: 'bmoor-crud:route',
										method: 'get',
										path: '/hello/:id'
									}
								]
							}
						]
					},
					{
						$schema: 'bmoor-crud:router',
						path: '/crud',
						routes: [
							{
								$schema: 'bmoor-crud:router',
								path: '/service-1',
								routes: [
									{
										$schema: 'bmoor-crud:route',
										method: 'delete',
										path: ''
									},
									{
										$schema: 'bmoor-crud:route',
										method: 'get',
										path: ''
									},
									{
										$schema: 'bmoor-crud:route',
										method: 'patch',
										path: ''
									},
									{
										$schema: 'bmoor-crud:route',
										method: 'post',
										path: ''
									},
									{
										$schema: 'bmoor-crud:route',
										method: 'delete',
										path: '/:id'
									},
									{
										$schema: 'bmoor-crud:route',
										method: 'get',
										path: '/:id'
									},
									{
										$schema: 'bmoor-crud:route',
										method: 'patch',
										path: '/:id'
									},
									{
										$schema: 'bmoor-crud:route',
										method: 'put',
										path: '/:id'
									}
								]
							}
						]
					},
					{
						$schema: 'bmoor-crud:router',
						path: '/querier',
						routes: [
							{
								$schema: 'bmoor-crud:route',
								method: 'post',
								path: ''
							},
							{
								$schema: 'bmoor-crud:route',
								method: 'get',
								path: '/:type/:name'
							}
						]
					},
					{
						$schema: 'bmoor-crud:router',
						path: '/synthetic',
						routes: [
							{
								$schema: 'bmoor-crud:router',
								path: '/composite-1',
								routes: [
									{
										$schema: 'bmoor-crud:route',
										method: 'get',
										path: ''
									} /*
									{
										'$schema': 'bmoor-crud:route',
										'method': 'post',
										'path': ''
									},*/,
									{
										$schema: 'bmoor-crud:route',
										method: 'get',
										path: '/:id'
									}
								]
							}
						]
					},
					{
						$schema: 'bmoor-crud:router',
						path: '/utility',
						routes: [
							{
								$schema: 'bmoor-crud:router',
								path: '/service-1',
								routes: [
									{
										$schema: 'bmoor-crud:route',
										method: 'get',
										path: '/hello'
									}
								]
							}
						]
					}
				]
			});
		});
	});
});
