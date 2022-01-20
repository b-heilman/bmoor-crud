const {expect} = require('chai');
const sinon = require('sinon');

const {Bus} = require('../server/bus.js');
const {Nexus} = require('./nexus.js');
const {Context} = require('../server/context.js');

const sut = require('./forge.js');

describe('src/env/forge.js', function () {
	let bus = null;
	let stubs = null;
	let nexus = null;
	let forge = null;

	let interfaceResults1 = null;
	let interfaceResults2 = null;

	beforeEach(async function () {
		stubs = {
			execute1: sinon.stub().callsFake(async function () {
				return interfaceResults1;
			}),
			execute2: sinon.stub().callsFake(async function () {
				return interfaceResults2;
			})
		};

		bus = new Bus();
		nexus = new Nexus();

		await nexus.setConnector('test-c-1', async () => ({
			execute: async (...args) => stubs.execute1(...args)
		}));

		await nexus.setConnector('test-c-2', async () => ({
			execute: async (...args) => stubs.execute2(...args)
		}));

		await nexus.configureSource('test-1', {
			connector: 'test-c-1'
		});

		await nexus.configureSource('test-2', {
			connector: 'test-c-2'
		});

		forge = new sut.Forge(nexus, bus);
	});

	afterEach(function () {
		Object.values(stubs).forEach((stub) => {
			if (stub.restore) {
				stub.restore();
			}
		});
	});

	describe('eventing', function () {
		let ctx = null;

		let service1 = null;
		let service2 = null;

		beforeEach(async function () {
			ctx = new Context({method: ''});

			service1 = nexus.getCrud('service-1');
			service2 = nexus.getCrud('service-2');

			await forge.installCruds([
				{
					name: 'service-1',
					settings: {
						source: 'test-1',
						fields: {
							id: {
								key: true,
								read: true
							},
							foo: true,
							hello: false
						}
					}
				},
				{
					name: 'service-2',
					settings: {
						source: 'test-2',
						fields: {
							id: {
								key: true,
								read: true
							},
							foo: true,
							hello: true
						}
					}
				}
			]);
		});

		describe('::configureCrud', function () {
			it('should allow for the subscription of afterCreate events', async function () {
				interfaceResults1 = [
					{
						foo: 'bar',
						id: 10
					}
				];

				bus.broadcast.on('service-1.create', function (key, was, datum, myCtx) {
					expect(key).to.deep.equal(10);

					expect(datum).to.deep.equal({id: 10, foo: 'bar'});

					expect(ctx).to.equal(myCtx);

					myCtx.addChange('foo', 'bar', 2, {hello: 'world'});
				});

				const res = await service1.create({eins: 1}, ctx);

				expect(res).to.deep.equal({id: 10, foo: 'bar'});

				expect(ctx.getChanges()).to.deep.equal([
					{
						model: 'foo',
						action: 'bar',
						key: 2,
						from: {hello: 'world'},
						to: null,
						md: {}
					},
					{
						model: 'service-1',
						action: 'create',
						key: 10,
						to: {id: 10, foo: 'bar'},
						from: null,
						md: {}
					}
				]);
			});

			it('should allow for the subscription of afterUpdate events', async function () {
				interfaceResults1 = [
					{
						id: 20,
						foo: 'bar'
					}
				];

				bus.broadcast.on('service-1.update', function (key, was, datum, myCtx) {
					expect(key).to.deep.equal(1);

					expect(datum).to.deep.equal({id: 20, foo: 'bar'});

					expect(ctx).to.equal(myCtx);

					myCtx.addChange('foo', 'bar', 3, {hello: 'world'});
				});

				const res = await service1.update(1, {eins: 1}, ctx);

				expect(res).to.deep.equal({id: 20, foo: 'bar'});

				expect(ctx.getChanges()).to.deep.equal([
					{
						model: 'foo',
						action: 'bar',
						key: 3,
						from: {hello: 'world'},
						to: null,
						md: {}
					},
					{
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
					}
				]);
			});

			it('should allow for the subscription of afterDelete events', async function () {
				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				bus.broadcast.on('service-1.delete', function (key, datum, _, myCtx) {
					expect(key).to.equal(1);

					expect(datum).to.deep.equal({foo: 'bar'});

					expect(ctx).to.equal(myCtx);

					myCtx.addChange('foo', 'bar', 3, {hello: 'world'});
				});

				const res = await service1.delete(1, ctx);

				expect(res).to.deep.equal({foo: 'bar'});

				expect(ctx.getChanges()).to.deep.equal([
					{
						model: 'foo',
						action: 'bar',
						key: 3,
						from: {hello: 'world'},
						to: null,
						md: {}
					},
					{
						model: 'service-1',
						action: 'delete',
						key: 1,
						to: null,
						from: {foo: 'bar'},
						md: {}
					}
				]);
			});
		});

		describe('::subscribe', function () {
			it('should subscribe to afterCreate', async function () {
				let triggered = false;

				await forge.subscribe('service-1', [
					{
						model: 'foo-bar',
						action: 'create',
						callback: function (service, eins, zwei) {
							expect(service).to.equal(service1);

							expect(eins).to.equal(1);

							expect(zwei).to.equal(2);

							triggered = true;
						}
					}
				]);

				await bus.broadcast.trigger('foo-bar.create', 1, 2);

				expect(triggered).to.equal(true);
			});

			it('should allow stacking of triggers', async function () {
				let triggered = 0;

				await forge.subscribe('service-1', [
					{
						model: 'foo-bar',
						action: 'create',
						callback: function () {
							triggered++;
						}
					},
					{
						model: 'foo-bar',
						action: 'create',
						callback: function () {
							triggered++;
						}
					}
				]);

				await bus.broadcast.trigger('foo-bar.create', 1, 2);

				expect(triggered).to.equal(2);
			});

			it('should subscribe to afterUpdate', async function () {
				let triggered = false;

				await forge.subscribe('service-1', [
					{
						model: 'foo-bar',
						action: 'update',
						callback: function (service, eins, zwei) {
							expect(service).to.equal(service1);

							expect(eins).to.equal(1);

							expect(zwei).to.equal(2);

							triggered = true;
						}
					}
				]);

				await bus.broadcast.trigger('foo-bar.update', 1, 2);

				expect(triggered).to.equal(true);
			});

			it('should subscribe to afterDelete', async function () {
				let triggered = false;

				await forge.subscribe('service-1', [
					{
						model: 'foo-bar',
						action: 'delete',
						callback: function (service, eins, zwei) {
							expect(service).to.equal(service1);

							expect(eins).to.equal(1);

							expect(zwei).to.equal(2);

							triggered = true;
						}
					}
				]);

				await bus.broadcast.trigger('foo-bar.delete', 1, 2);

				expect(triggered).to.equal(true);
			});
		});

		describe('::configureCrud should play nice with ::subscribe', function () {
			it('should work for create', async function () {
				interfaceResults1 = [
					{
						id: 30,
						foo: 'bar'
					}
				];

				interfaceResults2 = [
					{
						id: 31,
						hello: 'world'
					}
				];

				await forge.subscribe('service-2', [
					{
						model: 'service-1',
						action: 'create',
						callback: function (service, key, was, datum, myCtx) {
							expect(key).to.equal(30);

							expect(service).to.equal(service2);

							expect(datum).to.deep.equal({id: 30, foo: 'bar'});

							return service.create({'this-is': 'junk'}, myCtx);
						}
					}
				]);

				await service1.create({eins: 1}, ctx);

				expect(ctx.getChanges()).to.deep.equal([
					{
						model: 'service-2',
						action: 'create',
						key: 31,
						from: null,
						to: {
							id: 31,
							hello: 'world'
						},
						md: {}
					},
					{
						model: 'service-1',
						action: 'create',
						key: 30,
						from: null,
						to: {
							id: 30,
							foo: 'bar'
						},
						md: {}
					}
				]);
			});

			it('should work for update', async function () {
				interfaceResults1 = [
					{
						foo: 'bar',
						id: 40
					}
				];

				interfaceResults2 = [
					{
						hello: 'world',
						id: 41
					}
				];

				await forge.subscribe('service-2', [
					{
						model: 'service-1',
						action: 'update',
						callback: function (service, key, was, datum, myCtx) {
							expect(key).to.equal(1);

							expect(service).to.equal(service2);

							expect(datum).to.deep.equal({id: 40, foo: 'bar'});

							return service.create({'this-is': 'junk'}, myCtx);
						}
					}
				]);

				await service1.update(1, {eins: 1}, ctx);

				expect(ctx.getChanges()).to.deep.equal([
					{
						model: 'service-2',
						action: 'create',
						key: 41,
						from: null,
						to: {
							id: 41,
							hello: 'world'
						},
						md: {}
					},
					{
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
					}
				]);
			});

			it('should work for delete', async function () {
				interfaceResults1 = [
					{
						id: 100,
						foo: 'bar'
					}
				];

				interfaceResults2 = [
					{
						id: 101,
						hello: 'world'
					}
				];

				await forge.subscribe('service-2', [
					{
						model: 'service-1',
						action: 'delete',
						callback: function (service, key, was, datum, myCtx) {
							expect(key).to.equal(1);

							expect(service).to.equal(service2);

							expect(was).to.deep.equal({id: 100, foo: 'bar'});

							return service.create({'this-is': 'junk'}, myCtx);
						}
					}
				]);

				await service1.delete(1, ctx);

				expect(ctx.getChanges()).to.deep.equal([
					{
						model: 'service-2',
						action: 'create',
						key: 101,
						from: null,
						to: {
							id: 101,
							hello: 'world'
						},
						md: {}
					},
					{
						model: 'service-1',
						action: 'delete',
						key: 1,
						to: null,
						from: {
							id: 100,
							foo: 'bar'
						},
						md: {}
					}
				]);
			});
		});
	});

	describe('::secure via Service::clean', function () {
		let ctx = null;
		let service1 = null;

		beforeEach(async function () {
			ctx = new Context({method: ''});

			nexus.configureModel('service-1', {
				source: 'test-1',
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

			interfaceResults1 = [
				{
					foo: 'bar'
				}
			];

			service1 = await nexus.configureCrud('service-1');

			// await forge.secure('service-1');
		});

		describe('with blanket rejection', function () {
			beforeEach(function () {
				ctx.hasPermission = () => false;
			});

			describe('create', function () {
				it('should prune fields', async function () {
					await service1.create(
						{
							eins: 1,
							zwei: 2,
							drei: 3,
							fier: 4
						},
						ctx
					);

					const args = stubs.execute1.getCall(0).args;

					expect(args[0].models[0].payload).to.deep.equal({
						eins: 1,
						zwei: 2
					});
				});
			});

			describe('update', function () {
				it('should prune fields', async function () {
					await service1.update(
						1,
						{
							eins: 1,
							zwei: 2,
							drei: 3,
							fier: 4
						},
						ctx
					);

					const args = stubs.execute1.getCall(1).args;

					expect(args[0].models[0].payload).to.deep.equal({
						eins: 1,
						zwei: 2
					});
				});
			});

			describe('query', function () {
				it('should prune fields', async function () {
					let caught = false;

					try {
						await service1.query(
							{
								params: {
									eins: 1,
									zwei: 2,
									drei: 3,
									fier: 4
								}
							},
							ctx
						);

						const args = stubs.execute1.getCall(0).args;

						expect(args[0].query).to.deep.equal({
							eins: 1,
							zwei: 2
						});
					} catch (ex) {
						caught = true;
					}

					expect(caught).to.equal(true);
				});

				it('should be ok if no protected fields sent', async function () {
					await service1.query(
						{
							params: {
								eins: 1
							}
						},
						ctx
					);

					const args = stubs.execute1.getCall(0).args[0];

					expect(args).to.deep.equal({
						method: 'read',
						sourceName: 'test-1',
						models: [
							{
								series: 'service-1',
								schema: 'service-1',
								joins: []
							}
						],
						fields: [
							{
								series: 'service-1',
								path: 'zwei',
								as: 'zwei'
							},
							{
								series: 'service-1',
								path: 'drei',
								as: 'drei'
							}
						],
						filters: [],
						params: [
							{
								series: 'service-1',
								path: 'eins',
								operation: '=',
								value: 1,
								settings: {}
							}
						]
					});
				});
			});
		});

		describe('with blanket acceptance', function () {
			beforeEach(function () {
				ctx.hasPermission = () => true;
			});

			describe('create', function () {
				it('should prune fields', async function () {
					await service1.create(
						{
							eins: 1,
							zwei: 2,
							drei: 3,
							fier: 4
						},
						ctx
					);

					const args = stubs.execute1.getCall(0).args;

					expect(args[0].models[0].payload).to.deep.equal({
						eins: 1,
						zwei: 2,
						fier: 4
					});
				});
			});

			describe('update', function () {
				it('should prune fields', async function () {
					await service1.update(
						1,
						{
							eins: 1,
							zwei: 2,
							drei: 3,
							fier: 4
						},
						ctx
					);

					const args = stubs.execute1.getCall(1).args;

					expect(args[0].models[0].payload).to.deep.equal({
						eins: 1,
						zwei: 2,
						fier: 4
					});
				});
			});

			describe('query', function () {
				it('should prune fields', async function () {
					await service1.query(
						{
							params: {
								eins: 1,
								zwei: 2,
								drei: 3,
								fier: 4
							}
						},
						ctx
					);

					const args = stubs.execute1.getCall(0).args[0];

					expect(args).to.deep.equal({
						method: 'read',
						sourceName: 'test-1',
						models: [
							{
								series: 'service-1',
								schema: 'service-1',
								joins: []
							}
						],
						fields: [
							{
								series: 'service-1',
								path: 'zwei',
								as: 'zwei'
							},
							{
								series: 'service-1',
								path: 'drei',
								as: 'drei'
							}
						],
						filters: [],
						params: [
							{
								series: 'service-1',
								path: 'eins',
								operation: '=',
								settings: {},
								value: 1
							},
							{
								series: 'service-1',
								path: 'zwei',
								operation: '=',
								settings: {},
								value: 2
							},
							{
								series: 'service-1',
								path: 'drei',
								operation: '=',
								settings: {},
								value: 3
							},
							{
								series: 'service-1',
								path: 'fier',
								operation: '=',
								settings: {},
								value: 4
							}
						]
					});
				});
			});
		});

		describe('with blanket acceptance', function () {
			let check = null;

			beforeEach(function () {
				ctx.hasPermission = (permission) => check(permission);
			});

			describe('create', function () {
				it('should allow fields with permission', async function () {
					check = (permission) => permission === 'can-create';

					await service1.create(
						{
							eins: 1,
							zwei: 2,
							drei: 3,
							fier: 4
						},
						ctx
					);

					const args = stubs.execute1.getCall(0).args;

					expect(args[0].models[0].payload).to.deep.equal({
						eins: 1,
						zwei: 2,
						fier: 4
					});
				});

				it('should prune fields without permission', async function () {
					check = (permission) => permission === 'no-create';

					await service1.create(
						{
							eins: 1,
							zwei: 2,
							drei: 3,
							fier: 4
						},
						ctx
					);

					const args = stubs.execute1.getCall(0).args;

					expect(args[0].models[0].payload).to.deep.equal({
						eins: 1,
						zwei: 2
					});
				});
			});

			describe('update', function () {
				it('should allow fields with permission', async function () {
					check = (permission) => permission === 'can-update';

					await service1.update(
						1,
						{
							eins: 1,
							zwei: 2,
							drei: 3,
							fier: 4
						},
						ctx
					);

					const args = stubs.execute1.getCall(1).args;

					expect(args[0].models[0].payload).to.deep.equal({
						eins: 1,
						zwei: 2,
						fier: 4
					});
				});

				it('should prune fields without permission', async function () {
					check = (permission) => permission === 'no-create';

					await service1.create(
						{
							eins: 1,
							zwei: 2,
							drei: 3,
							fier: 4
						},
						ctx
					);

					const args = stubs.execute1.getCall(0).args;

					expect(args[0].models[0].payload).to.deep.equal({
						eins: 1,
						zwei: 2
					});
				});
			});

			describe('query', function () {
				it('should allow fields with permission', async function () {
					check = (permission) => permission === 'can-query';

					await service1.query(
						{
							params: {
								eins: 1,
								zwei: 2,
								drei: 3,
								fier: 4
							}
						},
						ctx
					);

					const args = stubs.execute1.getCall(0).args[0];

					expect(args).to.deep.equal({
						method: 'read',
						sourceName: 'test-1',
						models: [
							{
								series: 'service-1',
								schema: 'service-1',
								joins: []
							}
						],
						fields: [
							{
								series: 'service-1',
								path: 'zwei',
								as: 'zwei'
							},
							{
								series: 'service-1',
								path: 'drei',
								as: 'drei'
							}
						],
						filters: [],
						params: [
							{
								series: 'service-1',
								path: 'eins',
								operation: '=',
								settings: {},
								value: 1
							},
							{
								series: 'service-1',
								path: 'zwei',
								operation: '=',
								settings: {},
								value: 2
							},
							{
								series: 'service-1',
								path: 'drei',
								operation: '=',
								settings: {},
								value: 3
							},
							{
								series: 'service-1',
								path: 'fier',
								operation: '=',
								settings: {},
								value: 4
							}
						]
					});
				});

				it('should prune fields without permission', async function () {
					let failed = false;

					check = (permission) => permission === 'no-query';

					try {
						await service1.query(
							{
								params: {
									eins: 1,
									zwei: 2,
									drei: 3,
									fier: 4
								}
							},
							ctx
						);

						const args = stubs.execute1.getCall(0).args;

						expect(args[0].models[0].payload).to.deep.equal({
							eins: 1,
							zwei: 2
						});
					} catch (ex) {
						failed = true;
					}

					expect(failed).to.equal(true);
				});
			});
		});
	});

	describe('::install', function () {
		const {Config} = require('bmoor/src/lib/config.js');

		let ctx = null;
		let trace = null;
		let service = null;
		let permissions = null;

		beforeEach(async function () {
			trace = [];
			permissions = {};

			stubs.effect = sinon.stub();
			stubs.execute = sinon.stub();

			ctx = new Context({
				method: '',
				permissions
			});

			const cfg = new Config({
				cruds: [
					{
						name: 'service-1',
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
					},
					{
						name: 'service-3',
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
									create: true,
									read: true,
									link: {
										name: 'service-1',
										field: 'id'
									}
								},
								service2Id: {
									create: true,
									read: true,
									link: {
										name: 'service-2',
										field: 'id'
									}
								}
							}
						}
					},
					{
						name: 'service-4',
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
								service3Id: {
									create: true,
									read: true,
									link: {
										name: 'service-3',
										field: 'id'
									}
								}
							}
						}
					}
				],
				documents: [
					{
						name: 'doc-1',
						settings: {
							base: 'service-1',
							joins: [],
							fields: {
								id: '.id',
								name: '.name'
							}
						}
					},
					{
						name: 'doc-2',
						settings: {
							base: 'service-4',
							joins: [],
							fields: {
								id: '.id',
								name: '.name'
							}
						}
					},
					{
						name: 'doc-3',
						settings: {
							base: 'service-3',
							joins: ['> $service-1', '> $service-2', '> #doc-2'],
							fields: {
								id: '.id',
								name: '.name',
								service1Name: '$service-1.name',
								service2Name: '$service-2.name',
								links: ['#doc-2']
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
				security: [
					{
						name: 'service-1',
						settings: {
							canCreate: async function () {
								trace.push(2);
								return true;
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
								callback: stubs.effect
							}
						]
					}
				]
			});

			await forge.install(cfg);

			// this method is not real
			service = await nexus.loadCrud('service-1');
		});

		it('should properly define the models', function () {
			expect(service.structure.fields.length).to.equal(2);

			expect(service.structure.fields[0].path).to.equal('id');

			expect(service.structure.fields[1].path).to.equal('name');
		});

		describe('the service', function () {
			it('should correctly run create', async function () {
				interfaceResults1 = [
					{
						name: 'something',
						junk: 'value'
					}
				];

				const res = await service.create({foo: 'bar2', eins: 1}, ctx);

				expect(res).to.deep.equal({name: 'something'});
			});
		});

		it('should properly apply the security', async function () {
			it('should correctly run read', async function () {
				permissions['can-read'] = true;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				const res = await service.read(1, ctx);

				expect(res).to.deep.equal({foo: 'bar'});
			});

			it('should fail to run read without correct permissions', async function () {
				permissions['can-read'] = false;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				let failed = false;
				try {
					const res = await service.read(1, ctx);

					expect(res).to.deep.equal({foo: 'bar'});
				} catch (ex) {
					failed = true;

					expect(ex.code).to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed).to.equal(true);
			});

			it('should correctly run update', async function () {
				permissions['can-read'] = true;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				const res = await service.update(12, {eins: 1}, ctx);

				expect(res).to.deep.equal({foo: 'bar'});
			});

			it('should fail to run update without correct permissions', async function () {
				permissions['can-read'] = false;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				let failed = false;
				try {
					const res = await service.update(12, {}, ctx);

					expect(res).to.deep.equal({foo: 'bar'});
				} catch (ex) {
					failed = true;

					expect(ex.code).to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed).to.equal(true);
			});

			it('should correctly run delete', async function () {
				permissions['can-read'] = true;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				const res = await service.delete(12, ctx);

				expect(res).to.deep.equal({foo: 'bar'});
			});

			it('should fail to run delete without correct permissions', async function () {
				permissions['can-read'] = false;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				let failed = false;
				try {
					const res = await service.delete(12, ctx);

					expect(res).to.deep.equal({foo: 'bar'});
				} catch (ex) {
					failed = true;

					expect(ex.code).to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed).to.equal(true);
			});
		});

		it('should properly apply the decorator', async function () {
			expect(service.hello()).to.equal('world');
		});

		it('should properly apply the hooks', async function () {
			it('should correctly run create', async function () {
				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				const res = await service.create({eins: 1}, ctx);

				expect(res).to.deep.equal({foo: 'bar'});

				expect(trace).to.deep.equal([1]);
			});
		});

		it('should properly apply the effects', async function () {
			permissions['can-read'] = true;

			interfaceResults1 = [
				{
					foo: 'bar'
				}
			];
			//--------- for the update

			const otherService = await nexus.loadCrud('service-2');

			let called = false;

			stubs.effect.callsFake(function (myService, key, from, to, myCtx) {
				called = true;

				expect(key).to.equal(13);

				expect(service).to.equal(myService);

				expect(ctx).to.equal(myCtx);
			});

			await otherService.update(13, {name: 'ok'}, ctx);

			expect(called).to.equal(true);
		});

		describe('documents', function () {
			let doc1 = null;
			let doc2 = null;
			let doc3 = null;

			beforeEach(async () => {
				doc1 = await nexus.loadDocument('doc-1');
				doc2 = await nexus.loadDocument('doc-2');
				doc3 = await nexus.loadDocument('doc-3');
			});

			it('should notify the correct documents on updated', async function () {
				let doc1Called = false;
				let doc2Called = false;
				let doc3Called = false;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				stubs.doc1Affected = sinon
					.stub(doc1, 'getAffectedByModel')
					.resolves([123]);

				stubs.doc2Affected = sinon
					.stub(doc2, 'getAffectedByModel')
					.resolves([234]);

				stubs.doc3Affected = sinon
					.stub(doc3, 'getAffectedByModel')
					.resolves([345]);

				forge.messageBus.addListener('doc-1', 'push', function (key) {
					doc1Called = true;

					expect(key).to.equal(123);
				});

				forge.messageBus.addListener('doc-2', 'push', function (key) {
					doc2Called = true;

					expect(key).to.equal(234);
				});

				forge.messageBus.addListener('doc-3', 'push', function (key) {
					doc3Called = true;

					expect(key).to.equal(345);
				});

				await service.update(1, {eins: 1}, ctx);

				expect(stubs.doc1Affected.callCount).to.equal(1);

				expect(stubs.doc2Affected.callCount).to.equal(0);

				expect(stubs.doc3Affected.callCount).to.equal(1);

				expect(doc1Called).to.equal(true);

				expect(doc2Called).to.equal(false);

				expect(doc3Called).to.equal(true);
			});

			it('should correctly hav documents bubble', async function () {
				let doc1Called = false;
				let doc2Called = false;
				let doc3Called = false;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				stubs.doc1Affected = sinon
					.stub(doc1, 'getAffectedByModel')
					.resolves([123]);

				stubs.doc2Affected = sinon
					.stub(doc2, 'getAffectedByModel')
					.resolves([234]);

				stubs.doc3Affected = sinon
					.stub(doc3, 'getAffectedBySub')
					.resolves([345]);

				forge.messageBus.addListener('doc-1', 'push', function (key) {
					doc1Called = true;

					expect(key).to.equal(123);
				});

				forge.messageBus.addListener('doc-2', 'push', function (key) {
					doc2Called = true;

					expect(key).to.equal(234);
				});

				forge.messageBus.addListener('doc-3', 'push', function (key) {
					doc3Called = true;

					expect(key).to.equal(345);
				});

				const service4 = await nexus.loadCrud('service-4');

				await service4.update(1, {eins: 1}, ctx);

				expect(stubs.doc1Affected.callCount).to.equal(0);

				expect(stubs.doc2Affected.callCount).to.equal(1);

				expect(stubs.doc3Affected.callCount).to.equal(1);

				expect(doc1Called).to.equal(false);

				expect(doc2Called).to.equal(true);

				expect(doc3Called).to.equal(true);
			});
		});
	});

	describe('::install via preload', function () {
		const {Config} = require('bmoor/src/lib/config.js');

		let ctx = null;
		let trace = null;
		let service = null;
		let permissions = null;

		beforeEach(async function () {
			trace = [];
			permissions = {};

			stubs.execute = sinon.stub();

			ctx = new Context({
				method: '',
				permissions
			});

			stubs.effect = sinon.stub();

			const cfg = new Config({
				cruds: [
					{
						name: 'service-1',
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
					},
					{
						name: 'service-3',
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
									create: true,
									read: true,
									link: {
										name: 'service-1',
										field: 'id'
									}
								},
								service2Id: {
									create: true,
									read: true,
									link: {
										name: 'service-2',
										field: 'id'
									}
								}
							}
						}
					},
					{
						name: 'service-4',
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
								service3Id: {
									create: true,
									read: true,
									link: {
										name: 'service-3',
										field: 'id'
									}
								}
							}
						}
					}
				],
				documents: [
					{
						name: 'doc-1',
						settings: {
							base: 'service-1',
							joins: [],
							fields: {
								id: '.id',
								name: '.name'
							}
						}
					},
					{
						name: 'doc-2',
						settings: {
							base: 'service-4',
							joins: [],
							fields: {
								id: '.id',
								name: '.name'
							}
						}
					},
					{
						name: 'doc-3',
						settings: {
							base: 'service-3',
							joins: ['> $service-1', '> $service-2', '> #doc-2'],
							fields: {
								id: '.id',
								name: '.name',
								service1Name: '$service-1.name',
								service2Name: '$service-2.name',
								links: ['#doc-2']
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
				security: [
					{
						name: 'service-1',
						settings: {
							canCreate: async function () {
								trace.push(2);
								return true;
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
								callback: stubs.effect
							}
						]
					}
				]
			});

			await forge.install(cfg);

			// this method is not real
			service = await nexus.loadCrud('service-1');
		});

		it('should properly define the models', function () {
			expect(service.structure.fields.length).to.equal(2);

			expect(service.structure.fields[0].path).to.equal('id');

			expect(service.structure.fields[1].path).to.equal('name');
		});

		describe('the service', function () {
			it('should correctly run create', async function () {
				interfaceResults1 = [
					{
						name: 'something',
						junk: 'value'
					}
				];

				const res = await service.create({foo: 'bar2', eins: 1}, ctx);

				expect(res).to.deep.equal({name: 'something'});
			});
		});

		it('should properly apply the security', async function () {
			it('should correctly run read', async function () {
				permissions['can-read'] = true;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				const res = await service.read(1, ctx);

				expect(res).to.deep.equal({foo: 'bar'});
			});

			it('should fail to run read without correct permissions', async function () {
				permissions['can-read'] = false;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				let failed = false;
				try {
					const res = await service.read(1, ctx);

					expect(res).to.deep.equal({foo: 'bar'});
				} catch (ex) {
					failed = true;

					expect(ex.code).to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed).to.equal(true);
			});

			it('should correctly run update', async function () {
				permissions['can-read'] = true;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				const res = await service.update(12, {eins: 1}, ctx);

				expect(res).to.deep.equal({foo: 'bar'});
			});

			it('should fail to run update without correct permissions', async function () {
				permissions['can-read'] = false;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				let failed = false;
				try {
					const res = await service.update(12, {}, ctx);

					expect(res).to.deep.equal({foo: 'bar'});
				} catch (ex) {
					failed = true;

					expect(ex.code).to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed).to.equal(true);
			});

			it('should correctly run delete', async function () {
				permissions['can-read'] = true;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				const res = await service.delete(12, ctx);

				expect(res).to.deep.equal({foo: 'bar'});
			});

			it('should fail to run delete without correct permissions', async function () {
				permissions['can-read'] = false;

				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				let failed = false;
				try {
					const res = await service.delete(12, ctx);

					expect(res).to.deep.equal({foo: 'bar'});
				} catch (ex) {
					failed = true;

					expect(ex.code).to.equal('BMOOR_CRUD_SERVICE_READ_FILTER');
				}

				expect(failed).to.equal(true);
			});
		});

		it('should properly apply the decorator', async function () {
			expect(service.hello()).to.equal('world');
		});

		it('should properly apply the hooks', async function () {
			it('should correctly run create', async function () {
				interfaceResults1 = [
					{
						foo: 'bar'
					}
				];

				const res = await service.create({eins: 1}, ctx);

				expect(res).to.deep.equal({foo: 'bar'});

				expect(trace).to.deep.equal([1]);
			});
		});

		it('should properly apply the effects', async function () {
			permissions['can-read'] = true;

			interfaceResults1 = [
				{
					foo: 'bar'
				}
			];
			//--------- for the update

			const otherService = await nexus.loadCrud('service-2');

			let called = false;

			stubs.effect.callsFake(function (myService, key, from, to, myCtx) {
				called = true;

				expect(key).to.equal(13);

				expect(service).to.equal(myService);

				expect(ctx).to.equal(myCtx);
			});

			await otherService.update(13, {name: 'ok'}, ctx);

			expect(called).to.equal(true);
		});
	});
});
