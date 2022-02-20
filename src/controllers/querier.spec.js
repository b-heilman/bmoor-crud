const {expect} = require('chai');
const sinon = require('sinon');

const {Nexus} = require('../env/nexus.js');
const {Context} = require('../server/context.js');

describe('src/controller/querier.js', function () {
	const sut = require('./querier.js');

	let nexus = null;
	let stubs = null;
	let permissions = null;
	let connectorResult = null;

	beforeEach(async function () {
		nexus = new Nexus();

		connectorResult = {};

		stubs = {
			execute: sinon.stub().callsFake(async function () {
				return connectorResult;
			})
		};

		await nexus.setConnector('test', async () => ({
			execute: async (...args) => stubs.execute(...args)
		}));

		await nexus.configureSource('test-1', {
			connector: 'test'
		});

		nexus.configureModel('test-group', {
			source: 'test-1',
			fields: {
				id: {
					read: true,
					key: true
				},
				name: {
					read: true,
					write: true,
					update: true,
					delete: true,
					query: true
				}
			}
		});
		await nexus.configureCrud('test-group', {});

		nexus.configureModel('test-user', {
			source: 'test-1',
			fields: {
				id: {
					read: true,
					key: true
				},
				name: {
					read: true,
					query: true
				},
				title: {
					read: true,
					query: true
				},
				groupId: {
					read: true,
					link: {
						name: 'test-group',
						field: 'id'
					}
				}
			}
		});
		await nexus.configureCrud('test-user', {});

		nexus.configureModel('test-stats', {
			source: 'test-1',
			fields: {
				id: {
					read: true,
					key: true
				},
				name: {
					read: true,
					write: true,
					update: true,
					delete: true,
					query: true
				},
				userId: {
					read: true,
					link: {
						name: 'test-user',
						field: 'id'
					}
				}
			}
		});
		await nexus.configureCrud('test-stats', {});
	});

	afterEach(function () {
		Object.values(stubs).forEach((stub) => {
			if (stub.restore) {
				stub.restore();
			}
		});
	});

	describe('method(get)', function () {
		let context = null;

		beforeEach(function () {
			context = new Context({method: 'get'});
			context.hasPermission = (perm) => !!permissions[perm];
		});

		describe('::query', function () {
			it('should succeed if reading by query', async function () {
				const querier = new sut.Querier(nexus);

				context.query = {
					join: ['$test-group > $test-user'],
					query:
						'$test-user.name ~ "something%like" &' +
						'$test-user.title ~ "%oye" & $test-group.name= "woot"'
				};

				context.content = {
					base: 'test-user',
					joins: ['> $test-stats'],
					fields: {
						user: '.name',
						stats: '$test-stats.name'
					}
				};

				connectorResult = [
					{
						user: 'user-1',
						stats: 'stat-1'
					},
					{
						user: 'user-2',
						stats: 'stat-2'
					}
				];

				const res = await querier.search(context);

				const args = stubs.execute.getCall(0).args[0];

				expect(args.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 'test-1',
					models: [
						{
							series: 'test-user',
							schema: 'test-user',
							joins: []
						},
						{
							series: 'test-stats',
							schema: 'test-stats',
							joins: [
								{
									name: 'test-user',
									optional: false,
									mappings: [
										{
											from: 'userId',
											to: 'id'
										}
									]
								}
							]
						},
						{
							series: 'test-group',
							schema: 'test-group',
							joins: [
								{
									name: 'test-user',
									optional: false,
									mappings: [
										{
											from: 'id',
											to: 'groupId'
										}
									]
								}
							]
						}
					],
					fields: [
						{
							series: 'test-user',
							as: 'user',
							path: 'name'
						},
						{
							series: 'test-stats',
							as: 'stats',
							path: 'name'
						}
					],
					filters: {
						expressables: [],
						join: 'and'
					},
					params: {
						join: 'and',
						expressables: [
							{
								series: 'test-user',
								path: 'name',
								operation: '~',
								value: 'something%like',
								settings: {}
							},
							{
								series: 'test-user',
								path: 'title',
								operation: '~',
								value: '%oye',
								settings: {}
							},
							{
								series: 'test-group',
								path: 'name',
								operation: '=',
								value: 'woot',
								settings: {}
							}
						]
					}
				});

				expect(res).to.deep.equal([
					{
						user: 'user-1',
						stats: 'stat-1'
					},
					{
						user: 'user-2',
						stats: 'stat-2'
					}
				]);
			});

			it('should fail if an invalid field is queried', async function () {
				const querier = new sut.Querier(nexus);

				context.query = {
					join: ['$test-group > $test-user'],
					query:
						'$test-user.groupId = 123'
				};

				context.content = {
					base: 'test-user',
					joins: ['> $test-stats'],
					fields: {
						user: '.name',
						stats: '$test-stats.name'
					}
				};

				connectorResult = [
					{
						user: 'user-1',
						stats: 'stat-1'
					},
					{
						user: 'user-2',
						stats: 'stat-2'
					}
				];

				let failed = false;

				try {
					await querier.search(context);
				} catch(ex){
					failed = true;

					expect(ex.message).to.equal('unqueriable field: test-user.groupId');
				}

				expect(failed).to.equal(true);
			});
		});
	});
});
