
const {expect} = require('chai');
const sinon = require('sinon');
const {Config} = require('bmoor/src/lib/config.js');

const {Nexus} = require('../env/nexus.js');
const {Context} = require('../server/context.js');

describe('src/controller/querier.js', function(){
	const sut = require('./querier.js');

	let nexus = null;
	let stubs = null;
	let connector = null;
	let permissions = null;
	let connectorExecute = null;

	beforeEach(async function(){
		connectorExecute = null;

		stubs = {
			execute: sinon.stub()
			.callsFake(async function(){
				return connectorExecute;
			})
		};

		permissions = {};

		connector = {
			execute: (...args) => stubs.execute(...args)
		};

		const interfaces = new Config({
			stub: function(){
				return connector;
			}
		});
		
		nexus = new Nexus(null, interfaces);

		nexus.configureModel('test-group', {
			connector: 'stub',
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
			connector: 'stub',
			fields: {
				id: {
					read: true,
					key: true
				},
				name: {
					read: true
				},
				title: {
					read: true
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
			connector: 'stub',
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

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => {
			if (stub.restore){
				stub.restore();
			}
		});
	});

	describe('method(get)', function(){
		let context = null;

		beforeEach(function(){
			context = new Context({method: 'get'});
			context.hasPermission = (perm) => !!permissions[perm];
		});

		describe('::query', function(){
			it('should succeed if reading by query', async function(){
				const querier = new sut.Querier(nexus);

				context.query = {
					join: [
						'$test-group > $test-user'
					],
					param: {
						'name': {
							'~': 'something%like'
						},
						'.title': {
							'~': '%oye'
						},
						'$test-group.name': 'woot'
					}
				};

				context.content = {
					base: 'test-user',
					joins: [
						'> $test-stats'
					],
					fields: {
						'user': '.name',
						'stats':  '$test-stats.name'
					}
				};

				connectorExecute = [{
					'user': 'user-1',
					'stats': 'stat-1'
				}, {
					'user': 'user-2',
					'stats': 'stat-2'
				}];

				const res = await querier.query(context);

				const args = stubs.execute.getCall(0).args[0];
			
				expect(args.method)
				.to.equal('read');

				expect(args.query.toJSON())
				.to.deep.equal({
					models: [{
						series: 'test-user',
						schema: 'test-user',
						joins: []
					}, {
						series: 'test-stats',
						schema: 'test-stats',
						joins: [{
							name: 'test-user',
							optional: false,
							mappings: [{
								from: 'userId',
								to: 'id'
							}]
						}]
					}, {
						series: 'test-group',
						schema: 'test-group',
						joins: [{
							name: 'test-user',
							optional: false,
							mappings: [{
								from: 'id',
								to: 'groupId'
							}]
						}]
					}],
					fields: [{
						series: 'test-user',
						as: 'user',
						path: 'name'
					}, {
						series: 'test-stats',
						as: 'stats',
						path: 'name'
					}],
					params: [{
						series: 'test-user',
						path: 'name',
						operation: '~',
						value: 'something%like',
						settings: {}
					}, {
						series: 'test-user',
						path: 'title',
						operation: '~',
						value: '%oye',
						settings: {}
					}, {
						series: 'test-group',
						path: 'name',
						operation: '=',
						value: 'woot',
						settings: {}
					}]
				});

				expect(res)
				.to.deep.equal([{
					'user': 'user-1',
					'stats': 'stat-1'
				}, {
					'user': 'user-2',
					'stats': 'stat-2'
				}]);
			});
		});
	});
});
