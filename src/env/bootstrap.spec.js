
const {expect} = require('chai');
const sinon = require('sinon');

const sut = require('./bootstrap.js');

describe('src/env/bootstrap.js', function(){
	let stubs = null;

	beforeEach(function(){
		stubs = {
		};
	});

	afterEach(function(){
		for(let key in stubs){
			if (stubs[key].restore){
				stubs[key].restore();
			}
		}
	});

	describe('::install', function(){
		let bootstrap = null;

		beforeEach('should load everything correctly', async function(){
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
					read: 'can-read'
				}
			}]);

			bootstrap = new sut.Bootstrap(cfg);

			await bootstrap.install();
		});

		it('should install correctly', async function(){
			const res = JSON.parse(JSON.stringify(bootstrap));

			expect(res.crud)
			.to.deep.equal({
				services: [{
					'$schema': 'bmoor-crud:view',
					'structure': {
						'$schema': 'bmoor-crud:structure',
						'name': 'service-1',
						'fields': [{
							'path': 'id',
							'storage': {
								'schema': 'service-1',
								'path': 'id'
							},
							'usage': {}
						},
						{
							'path': 'name',
							'storage': {
								'schema': 'service-1',
								'path': 'name'
							},
							'usage': {}
						}]
					}
				}, {
					'$schema': 'bmoor-crud:view',
					'structure': {
						'$schema': 'bmoor-crud:structure',
						'name': 'service-2',
						'fields': [{
							'path': 'id',
							'storage': {
								'schema': 'service-2',
								'path': 'id'
							},
							'usage': {}
						}, {
							'path': 'name',
							'storage': {
								'schema': 'service-2',
								'path': 'name'
							},
							'usage': {}
						}, {
							'path': 'link',
							'storage': {
								'schema': 'service-2',
								'path': 'link'
							},
							'usage': {}
						}]
					}
				}],
				'documents': [{
					'$schema': 'bmoor-crud:view',
					'structure': {
						'$schema': 'bmoor-crud:structure',
						'name': 'composite-1',
						'fields': []
					}
				}]
			});

			expect(res.controllers)
			.to.deep.equal({
				'guards': [{
					'$schema': 'bmoor-crud:controller',
					'routes': [{
						'route': {
							'path': '',
							'method': 'post'
						},
						'structure': 'service-1'
					}, {
						'route': {
							'path': '/:id',
							'method': 'get'
						},
						'structure': 'service-1'
					}, {
						'route': {
							'path': '',
							'method': 'get'
						},
						'structure': 'service-1'
					}, {
						'route': {
							'path': '/:id',
							'method': 'put'
						},
						'structure': 'service-1'
					}, {
						'route': {
							'path': '/:id',
							'method': 'patch'
						},
						'structure': 'service-1'
					}, {
						'route': {
							'path': '/:id',
							'method': 'delete'
						},
						'structure': 'service-1'
					}, {
						'route': {
							'path': '',
							'method': 'delete'
						},
						'structure': 'service-1'
					}]
				}],
				'actions': [{
					'$schema': 'bmoor-crud:controller',
					'routes': [{
						'route': {
							'method': 'get',
							'path': '/hello/:id'
						},
						'structure': 'service-1'
					}]
				}],
				'utilities': [{
					'$schema': 'bmoor-crud:controller',
					'routes': [{
						'route': {
							'method': 'get',
							'path': '/hello'
						},
						'structure': 'service-1'
					}]
				}],
				'synthetics': [{
					'$schema': 'bmoor-crud:controller',
					'routes': [{
						'route': {
							'path': '',
							'method': 'post'
						},
						'structure': 'composite-1'
					}, {
						'route': {
							'path': '/:id',
							'method': 'get'
						},
						'structure': 'composite-1'
					}, {
						'route': {
							'path': '',
							'method': 'get'
						},
						'structure': 'composite-1'
					}]
				}]
			});

			expect(res.router)
			.to.deep.equal({
				'$schema': 'bmoor-crud:router',
				'path': '/bmoor',
				'routes': [
					{
						'$schema': 'bmoor-crud:router',
						'path': '/action',
						'routes': [
							{
								'$schema': 'bmoor-crud:router',
								'path': '/service-1',
								'routes': [
									{
										'$schema': 'bmoor-crud:route',
										'method': 'get',
										'path': '/hello/:id'
									}
								]
							}
						]
					},
					{
						'$schema': 'bmoor-crud:router',
						'path': '/crud',
						'routes': [
							{
								'$schema': 'bmoor-crud:router',
								'path': '/service-1',
								'routes': [
									{
										'$schema': 'bmoor-crud:route',
										'method': 'delete',
										'path': ''
									},
									{
										'$schema': 'bmoor-crud:route',
										'method': 'get',
										'path': ''
									},
									{
										'$schema': 'bmoor-crud:route',
										'method': 'post',
										'path': ''
									},
									{
										'$schema': 'bmoor-crud:route',
										'method': 'delete',
										'path': '/:id'
									},
									{
										'$schema': 'bmoor-crud:route',
										'method': 'get',
										'path': '/:id'
									},
									{
										'$schema': 'bmoor-crud:route',
										'method': 'patch',
										'path': '/:id'
									},
									{
										'$schema': 'bmoor-crud:route',
										'method': 'put',
										'path': '/:id'
									}
								]
							}
						]
					},
					{
						'$schema': 'bmoor-crud:router',
						'path': '/synthetic',
						'routes': [
							{
								'$schema': 'bmoor-crud:router',
								'path': '/composite-1',
								'routes': [
									{
										'$schema': 'bmoor-crud:route',
										'method': 'get',
										'path': ''
									},
									{
										'$schema': 'bmoor-crud:route',
										'method': 'post',
										'path': ''
									},
									{
										'$schema': 'bmoor-crud:route',
										'method': 'get',
										'path': '/:id'
									}
								]
							}
						]
					},
					{
						'$schema': 'bmoor-crud:router',
						'path': '/utility',
						'routes': [
							{
								'$schema': 'bmoor-crud:router',
								'path': '/service-1',
								'routes': [
									{
										'$schema': 'bmoor-crud:route',
										'method': 'get',
										'path': '/hello'
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
