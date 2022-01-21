const sinon = require('sinon');
const {expect} = require('chai');

const sut = require('./querier.js');

const {Cache} = require('../server/cache.js');
const {Context} = require('../server/context.js');

const {StatementField} = require('../schema/statement/field.js');
const {StatementFilter} = require('../schema/statement/filter.js');
const {StatementParam} = require('../schema/statement/param.js');

const {QueryJoin} = require('../schema/query/join.js');
const {QuerySort} = require('../schema/query/sort.js');
const {QueryStatement} = require('../schema/query/statement.js');

describe('src/schema/services/querier.js', function () {
	let stubs = null;

	beforeEach(function () {
		stubs = {};
	});

	afterEach(function () {
		Object.values(stubs).forEach((stub) => {
			if (stub.restore) {
				stub.restore();
			}
		});
	});

	describe('single source', function () {
		let source = null;
		let query = null;

		beforeEach(function () {
			query = new QueryStatement('a');

			stubs.execute = sinon.stub();

			source = {execute: stubs.execute};

			query.setModel('a', {
				schema: 'schemaA',
				incomingSettings: {
					source: 'ok'
				}
			});
			query.setModel('c', {
				schema: 'schemaC',
				incomingSettings: {
					source: 'ok'
				}
			});
			query.setModel('b', {
				schema: 'schemaB',
				incomingSettings: {
					source: 'ok'
				}
			});

			query.addJoins('b', [
				new QueryJoin('a', [{from: 'aId', to: 'id'}]),
				new QueryJoin('c', [{from: 'cId', to: 'id'}])
			]);

			query.addSorts('a', [new QuerySort('bar', 2, true)]);

			query.addSorts('c', [new QuerySort('foo', 1, false)]);
		});

		describe('::query', function () {
			it('should work', async function () {
				stubs.execute.resolves([{hello: 'world'}]);

				const exe = new sut.Querier('examp-1', query);
				const ctx = {};

				await exe.link({
					loadSource: async function () {
						return source;
					}
				});

				const res = await exe.run(ctx);

				const args = stubs.execute.getCall(0).args[0];
				expect(args.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 'ok',
					models: [
						{
							series: 'a',
							schema: 'schemaA',
							joins: []
						},
						{
							series: 'b',
							schema: 'schemaB',
							joins: [
								{
									name: 'a',
									optional: false,
									mappings: [
										{
											from: 'aId',
											to: 'id'
										}
									]
								}
							]
						},
						{
							series: 'c',
							schema: 'schemaC',
							joins: [
								{
									name: 'b',
									optional: false,
									mappings: [
										{
											from: 'id',
											to: 'cId'
										}
									]
								}
							]
						}
					],
					fields: [],
					filters: [],
					params: [],
					sorts: [
						{
							path: 'foo',
							pos: 1,
							series: 'c',
							ascending: false
						},
						{
							path: 'bar',
							pos: 2,
							series: 'a',
							ascending: true
						}
					]
				});

				expect(res).to.deep.equal([{hello: 'world'}]);
			});
		});

		describe('::toJSON', function () {
			it('should work', async function () {
				const exe = new sut.Querier('examp-2', query);

				expect(exe.toJSON()).to.deep.equal([
					{
						method: 'read',
						sourceName: 'ok',
						models: [
							{
								series: 'a',
								schema: 'schemaA',
								joins: []
							},
							{
								series: 'b',
								schema: 'schemaB',
								joins: [
									{
										name: 'a',
										optional: false,
										mappings: [
											{
												from: 'aId',
												to: 'id'
											}
										]
									}
								]
							},
							{
								series: 'c',
								schema: 'schemaC',
								joins: [
									{
										name: 'b',
										optional: false,
										mappings: [
											{
												from: 'id',
												to: 'cId'
											}
										]
									}
								]
							}
						],
						fields: [],
						filters: [],
						params: [],
						externals: [],
						sorts: [
							{
								path: 'foo',
								pos: 1,
								series: 'c',
								ascending: false
							},
							{
								path: 'bar',
								pos: 2,
								series: 'a',
								ascending: true
							}
						]
					}
				]);
			});
		});
	});

	describe('central pivot table', function () {
		let query = null;
		let nexus = null;

		it('should work with a-b leading', async function () {
			query = new QueryStatement('a-b');

			stubs.execute = {
				a: sinon.stub(),
				b: sinon.stub()
			};

			const sources = {
				's-1': {
					execute: stubs.execute.a
				},
				's-2': {
					execute: stubs.execute.b
				}
			};

			nexus = {
				loadSource: async (sourceName) => sources[sourceName]
			};

			query.setModel('a-b', {
				schema: 'schemaAtoB',
				incomingSettings: {
					source: 's-1'
				}
			});

			query.setModel('b', {
				schema: 'schemaB',
				incomingSettings: {
					source: 's-2'
				}
			});

			query.addFields('b', [new StatementField('foo', 'bar')]);

			query.addJoins('a-b', [new QueryJoin('b', [{from: 'bId', to: 'id'}])]);

			query.addParams('a-b', [new StatementParam('aId', 567)]);

			stubs.execute.a.onCall(0).resolves([
				{
					exe_0: 'b-1'
				}
			]);

			stubs.execute.b.onCall(0).resolves([
				{
					bar: 'hello-world'
				}
			]);
			/**
			stubs.execute.b.onCall(0)
			.callsFake(async function(args){
				console.log('execute =>', JSON.stringify(args, null, '\t'));
				return null;
			});
			**/

			const exe = new sut.Querier('examp-3', query);
			const ctx = {};

			await exe.link(nexus);

			const res = await exe.run(ctx);

			const argsA = stubs.execute.a.getCall(0).args[0];
			expect(argsA.toJSON()).to.deep.equal({
				method: 'read',
				sourceName: 's-1',
				models: [
					{
						series: 'a-b',
						schema: 'schemaAtoB',
						joins: []
					}
				],
				fields: [
					{
						series: 'a-b',
						path: 'bId',
						as: 'exe_0'
					}
				],
				filters: [],
				params: [
					{
						series: 'a-b',
						path: 'aId',
						operation: '=',
						value: 567,
						settings: {}
					}
				]
			});

			const argsB = stubs.execute.b.getCall(0).args[0];
			expect(argsB.toJSON()).to.deep.equal({
				method: 'read',
				sourceName: 's-2',
				models: [
					{
						series: 'b',
						schema: 'schemaB',
						joins: []
					}
				],
				fields: [
					{
						series: 'b',
						path: 'foo',
						as: 'bar'
					}
				],
				filters: [],
				params: [
					{
						series: 'b',
						path: 'id',
						operation: '=',
						value: 'b-1',
						settings: {}
					}
				]
			});

			expect(res).to.deep.equal([
				{
					bar: 'hello-world',
					exe_0: 'b-1'
				}
			]);
		});

		it('should work with b leading', async function () {
			query = new QueryStatement('b');

			stubs.execute = {
				a: sinon.stub(),
				b: sinon.stub()
			};

			const sources = {
				's-1': {
					execute: stubs.execute.a
				},
				's-2': {
					execute: stubs.execute.b
				}
			};

			nexus = {
				loadSource: async (sourceName) => sources[sourceName]
			};

			query.setModel('a-b', {
				schema: 'schemaAtoB',
				incomingSettings: {
					source: 's-1'
				}
			});

			query.setModel('b', {
				schema: 'schemaB',
				incomingSettings: {
					source: 's-2'
				}
			});

			query.addFields('b', [new StatementField('foo', 'bar')]);

			query.addJoins('a-b', [new QueryJoin('b', [{from: 'bId', to: 'id'}])]);

			query.addParams('a-b', [new StatementParam('aId', 567)]);

			stubs.execute.a.onCall(0).resolves([
				{
					exe_0: 'b-1'
				}
			]);

			stubs.execute.b.onCall(0).resolves([
				{
					bar: 'hello-world'
				}
			]);

			const exe = new sut.Querier('examp-3', query);
			const ctx = {};

			await exe.link(nexus);

			const res = await exe.run(ctx);

			const argsA = stubs.execute.a.getCall(0).args[0];
			expect(argsA.toJSON()).to.deep.equal({
				method: 'read',
				sourceName: 's-1',
				models: [
					{
						series: 'a-b',
						schema: 'schemaAtoB',
						joins: []
					}
				],
				fields: [
					{
						series: 'a-b',
						path: 'bId',
						as: 'exe_0'
					}
				],
				filters: [],
				params: [
					{
						series: 'a-b',
						path: 'aId',
						operation: '=',
						value: 567,
						settings: {}
					}
				]
			});

			const argsB = stubs.execute.b.getCall(0).args[0];
			expect(argsB.toJSON()).to.deep.equal({
				method: 'read',
				sourceName: 's-2',
				models: [
					{
						series: 'b',
						schema: 'schemaB',
						joins: []
					}
				],
				fields: [
					{
						series: 'b',
						path: 'foo',
						as: 'bar'
					}
				],
				filters: [],
				params: [
					{
						series: 'b',
						path: 'id',
						operation: '=',
						value: 'b-1',
						settings: {}
					}
				]
			});

			expect(res).to.deep.equal([
				{
					bar: 'hello-world',
					exe_0: 'b-1'
				}
			]);
		});
	});

	describe('multiple sources', function () {
		let query = null;
		let nexus = null;

		beforeEach(function () {
			query = new QueryStatement('a');

			stubs.execute = {
				a: sinon.stub(),
				b: sinon.stub(),
				c: sinon.stub()
			};

			const sources = {
				's-1': {
					execute: stubs.execute.a
				},
				's-2': {
					execute: stubs.execute.b
				},
				's-3': {
					execute: stubs.execute.c
				}
			};

			nexus = {
				loadSource: async (sourceName) => sources[sourceName]
			};

			query.setModel('a', {
				schema: 'schemaA',
				incomingSettings: {
					source: 's-1'
				}
			});
			query.setModel('b', {
				schema: 'schemaB',
				incomingSettings: {
					source: 's-2'
				}
			});
			query.setModel('c', {
				schema: 'schemaC',
				incomingSettings: {
					source: 's-3'
				}
			});

			query.addFields('b', [new StatementField('cId', 'fooBar')]);

			query.addJoins('b', [
				new QueryJoin('a', [{from: 'aId', to: 'id'}]),
				new QueryJoin('c', [{from: 'cId', to: 'id'}])
			]);

			query.addFilters('a', [new StatementFilter('param1', 123)]);

			query.addFilters('b', [new StatementFilter('param2', 456)]);

			query.addParams('b', [new StatementParam('param3', 567)]);

			query.addParams('c', [new StatementParam('param4', 890)]);
		});

		describe('::query', function () {
			it('should work', async function () {
				stubs.execute.b.resolves([
					{
						foo: 'bar',
						fooBar: 'id-2',
						exe_0: 'id-1'
					}
				]);

				stubs.execute.a.resolves([
					{
						hello: 'world'
					}
				]);

				stubs.execute.c.resolves([
					{
						eins: 'zwei'
					}
				]);

				const exe = new sut.Querier('examp-3', query);
				const ctx = {};

				await exe.link(nexus);

				const res = await exe.run(ctx);

				const argsB = stubs.execute.b.getCall(0).args[0];
				expect(argsB.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-2',
					models: [
						{
							series: 'b',
							schema: 'schemaB',
							joins: []
						}
					],
					fields: [
						{
							series: 'b',
							path: 'cId',
							as: 'fooBar'
						},
						{
							series: 'b',
							path: 'aId',
							as: 'exe_0'
						}
					],
					filters: [
						{
							operation: '=',
							path: 'param2',
							series: 'b',
							settings: {},
							value: 456
						}
					],
					params: [
						{
							operation: '=',
							path: 'param3',
							series: 'b',
							settings: {},
							value: 567
						}
					]
				});

				const argsA = stubs.execute.a.getCall(0).args[0];
				expect(argsA.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-1',
					models: [
						{
							series: 'a',
							schema: 'schemaA',
							joins: []
						}
					],
					fields: [],
					filters: [
						{
							operation: '=',
							path: 'param1',
							series: 'a',
							settings: {},
							value: 123
						}
					],
					params: [
						{
							operation: '=',
							path: 'id',
							series: 'a',
							settings: {},
							value: 'id-1'
						}
					]
				});

				const argsC = stubs.execute.c.getCall(0).args[0];
				expect(argsC.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-3',
					models: [
						{
							series: 'c',
							schema: 'schemaC',
							joins: []
						}
					],
					fields: [],
					filters: [],
					params: [
						{
							operation: '=',
							path: 'param4',
							series: 'c',
							settings: {},
							value: 890
						},
						{
							operation: '=',
							path: 'id',
							series: 'c',
							settings: {},
							value: 'id-2'
						}
					]
				});

				expect(res).to.deep.equal([
					{
						hello: 'world',
						foo: 'bar',
						eins: 'zwei',
						exe_0: 'id-1',
						fooBar: 'id-2'
					}
				]);
			});

			it('should work with combinations - no cache', async function () {
				stubs.execute.b.resolves([
					{
						foo: 'bar-1',
						exe_0: 'id-1-1',
						fooBar: 'id-2-1'
					},
					{
						foo: 'bar-2',
						exe_0: 'id-1-1',
						fooBar: 'id-2-2'
					},
					{
						foo: 'bar-3',
						exe_0: 'id-1-2',
						fooBar: 'id-2-1'
					}
				]);

				stubs.execute.a.resolves([
					{
						hello: 'world-1'
					},
					{
						hello: 'world-2'
					}
				]);

				stubs.execute.c.resolves([
					{
						eins: 'zwei-1'
					},
					{
						eins: 'zwei-2'
					}
				]);

				const exe = new sut.Querier('examp-4', query);

				await exe.link(nexus);

				const ctx = {};
				const res = await exe.run(ctx);

				const argsB = stubs.execute.b.getCall(0).args[0];
				expect(argsB.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-2',
					models: [
						{
							series: 'b',
							schema: 'schemaB',
							joins: []
						}
					],
					fields: [
						{
							series: 'b',
							path: 'cId',
							as: 'fooBar'
						},
						{
							series: 'b',
							path: 'aId',
							as: 'exe_0'
						}
					],
					filters: [
						{
							operation: '=',
							path: 'param2',
							series: 'b',
							settings: {},
							value: 456
						}
					],
					params: [
						{
							operation: '=',
							path: 'param3',
							series: 'b',
							settings: {},
							value: 567
						}
					]
				});

				expect(stubs.execute.b.getCall(2)).to.equal(null);

				const argsA0 = stubs.execute.a.getCall(0).args[0];
				expect(argsA0.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-1',
					models: [
						{
							series: 'a',
							schema: 'schemaA',
							joins: []
						}
					],
					fields: [],
					filters: [
						{
							operation: '=',
							path: 'param1',
							series: 'a',
							settings: {},
							value: 123
						}
					],
					params: [
						{
							operation: '=',
							path: 'id',
							series: 'a',
							settings: {},
							value: 'id-1-1'
						}
					]
				});

				const argsA1 = stubs.execute.a.getCall(1).args[0];
				expect(argsA1.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-1',
					models: [
						{
							series: 'a',
							schema: 'schemaA',
							joins: []
						}
					],
					fields: [],
					filters: [
						{
							operation: '=',
							path: 'param1',
							series: 'a',
							settings: {},
							value: 123
						}
					],
					params: [
						{
							operation: '=',
							path: 'id',
							series: 'a',
							settings: {},
							value: 'id-1-1'
						}
					]
				});

				const argsA2 = stubs.execute.a.getCall(2).args[0];
				expect(argsA2.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-1',
					models: [
						{
							series: 'a',
							schema: 'schemaA',
							joins: []
						}
					],
					fields: [],
					filters: [
						{
							operation: '=',
							path: 'param1',
							series: 'a',
							settings: {},
							value: 123
						}
					],
					params: [
						{
							operation: '=',
							path: 'id',
							series: 'a',
							settings: {},
							value: 'id-1-2'
						}
					]
				});

				const argsC0 = stubs.execute.c.getCall(0).args[0];
				expect(argsC0.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-3',
					models: [
						{
							series: 'c',
							schema: 'schemaC',
							joins: []
						}
					],
					fields: [],
					filters: [],
					params: [
						{
							operation: '=',
							path: 'param4',
							series: 'c',
							settings: {},
							value: 890
						},
						{
							operation: '=',
							path: 'id',
							series: 'c',
							settings: {},
							value: 'id-2-1'
						}
					]
				});

				const argsC1 = stubs.execute.c.getCall(1).args[0];
				expect(argsC1.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-3',
					models: [
						{
							series: 'c',
							schema: 'schemaC',
							joins: []
						}
					],
					fields: [],
					filters: [],
					params: [
						{
							operation: '=',
							path: 'param4',
							series: 'c',
							settings: {},
							value: 890
						},
						{
							operation: '=',
							path: 'id',
							series: 'c',
							settings: {},
							value: 'id-2-2'
						}
					]
				});

				const argsC2 = stubs.execute.c.getCall(2).args[0];
				expect(argsC2.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-3',
					models: [
						{
							series: 'c',
							schema: 'schemaC',
							joins: []
						}
					],
					fields: [],
					filters: [],
					params: [
						{
							operation: '=',
							path: 'param4',
							series: 'c',
							settings: {},
							value: 890
						},
						{
							operation: '=',
							path: 'id',
							series: 'c',
							settings: {},
							value: 'id-2-1'
						}
					]
				});

				expect(stubs.execute.c.getCall(3)).to.equal(null);

				expect(res).to.deep.equal([
					{
						foo: 'bar-1',
						exe_0: 'id-1-1',
						fooBar: 'id-2-1',
						eins: 'zwei-1',
						hello: 'world-1'
					},
					{
						foo: 'bar-1',
						exe_0: 'id-1-1',
						fooBar: 'id-2-1',
						eins: 'zwei-1',
						hello: 'world-2'
					},
					{
						foo: 'bar-1',
						exe_0: 'id-1-1',
						fooBar: 'id-2-1',
						eins: 'zwei-2',
						hello: 'world-1'
					},
					{
						foo: 'bar-1',
						exe_0: 'id-1-1',
						fooBar: 'id-2-1',
						eins: 'zwei-2',
						hello: 'world-2'
					},
					{
						foo: 'bar-2',
						exe_0: 'id-1-1',
						fooBar: 'id-2-2',
						eins: 'zwei-1',
						hello: 'world-1'
					},
					{
						foo: 'bar-2',
						exe_0: 'id-1-1',
						fooBar: 'id-2-2',
						eins: 'zwei-1',
						hello: 'world-2'
					},
					{
						foo: 'bar-2',
						exe_0: 'id-1-1',
						fooBar: 'id-2-2',
						eins: 'zwei-2',
						hello: 'world-1'
					},
					{
						foo: 'bar-2',
						exe_0: 'id-1-1',
						fooBar: 'id-2-2',
						eins: 'zwei-2',
						hello: 'world-2'
					},
					{
						foo: 'bar-3',
						exe_0: 'id-1-2',
						fooBar: 'id-2-1',
						eins: 'zwei-1',
						hello: 'world-1'
					},
					{
						foo: 'bar-3',
						exe_0: 'id-1-2',
						fooBar: 'id-2-1',
						eins: 'zwei-1',
						hello: 'world-2'
					},
					{
						foo: 'bar-3',
						exe_0: 'id-1-2',
						fooBar: 'id-2-1',
						eins: 'zwei-2',
						hello: 'world-1'
					},
					{
						foo: 'bar-3',
						exe_0: 'id-1-2',
						fooBar: 'id-2-1',
						eins: 'zwei-2',
						hello: 'world-2'
					}
				]);
			});

			it('should work with combinations - with cache', async function () {
				stubs.execute.b.resolves([
					{
						foo: 'bar-1',
						exe_0: 'id-1-1',
						fooBar: 'id-2-1'
					},
					{
						foo: 'bar-2',
						exe_0: 'id-1-1',
						fooBar: 'id-2-2'
					},
					{
						foo: 'bar-3',
						exe_0: 'id-1-2',
						fooBar: 'id-2-1'
					}
				]);

				stubs.execute.a.resolves([
					{
						hello: 'world-1'
					},
					{
						hello: 'world-2'
					}
				]);

				stubs.execute.c.resolves([
					{
						eins: 'zwei-1'
					},
					{
						eins: 'zwei-2'
					}
				]);

				const exe = new sut.Querier('examp-4', query);
				const ctx = new Context(
					{},
					{},
					{
						cache: new Cache({
							default: {
								ttl: 1 // 1s
							}
						})
					}
				);

				await exe.link(nexus);

				const res = await exe.run(ctx, {
					cacheable: true
				});

				const argsB = stubs.execute.b.getCall(0).args[0];
				expect(argsB.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-2',
					models: [
						{
							series: 'b',
							schema: 'schemaB',
							joins: []
						}
					],
					fields: [
						{
							series: 'b',
							path: 'cId',
							as: 'fooBar'
						},
						{
							series: 'b',
							path: 'aId',
							as: 'exe_0'
						}
					],
					filters: [
						{
							operation: '=',
							path: 'param2',
							series: 'b',
							settings: {},
							value: 456
						}
					],
					params: [
						{
							operation: '=',
							path: 'param3',
							series: 'b',
							settings: {},
							value: 567
						}
					]
				});

				expect(stubs.execute.b.getCall(2)).to.equal(null);

				const argsA0 = stubs.execute.a.getCall(0).args[0];
				expect(argsA0.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-1',
					models: [
						{
							series: 'a',
							schema: 'schemaA',
							joins: []
						}
					],
					fields: [],
					filters: [
						{
							operation: '=',
							path: 'param1',
							series: 'a',
							settings: {},
							value: 123
						}
					],
					params: [
						{
							operation: '=',
							path: 'id',
							series: 'a',
							settings: {},
							value: 'id-1-1'
						}
					]
				});

				const argsA2 = stubs.execute.a.getCall(1).args[0];
				expect(argsA2.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-1',
					models: [
						{
							series: 'a',
							schema: 'schemaA',
							joins: []
						}
					],
					fields: [],
					filters: [
						{
							operation: '=',
							path: 'param1',
							series: 'a',
							settings: {},
							value: 123
						}
					],
					params: [
						{
							operation: '=',
							path: 'id',
							series: 'a',
							settings: {},
							value: 'id-1-2'
						}
					]
				});

				expect(stubs.execute.a.getCall(2)).to.equal(null);

				const argsC0 = stubs.execute.c.getCall(0).args[0];
				expect(argsC0.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-3',
					models: [
						{
							series: 'c',
							schema: 'schemaC',
							joins: []
						}
					],
					fields: [],
					filters: [],
					params: [
						{
							operation: '=',
							path: 'param4',
							series: 'c',
							settings: {},
							value: 890
						},
						{
							operation: '=',
							path: 'id',
							series: 'c',
							settings: {},
							value: 'id-2-1'
						}
					]
				});

				const argsC1 = stubs.execute.c.getCall(1).args[0];
				expect(argsC1.toJSON()).to.deep.equal({
					method: 'read',
					sourceName: 's-3',
					models: [
						{
							series: 'c',
							schema: 'schemaC',
							joins: []
						}
					],
					fields: [],
					filters: [],
					params: [
						{
							operation: '=',
							path: 'param4',
							series: 'c',
							settings: {},
							value: 890
						},
						{
							operation: '=',
							path: 'id',
							series: 'c',
							settings: {},
							value: 'id-2-2'
						}
					]
				});

				expect(stubs.execute.c.getCall(2)).to.equal(null);

				expect(res).to.deep.equal([
					{
						foo: 'bar-1',
						exe_0: 'id-1-1',
						fooBar: 'id-2-1',
						eins: 'zwei-1',
						hello: 'world-1'
					},
					{
						foo: 'bar-1',
						exe_0: 'id-1-1',
						fooBar: 'id-2-1',
						eins: 'zwei-1',
						hello: 'world-2'
					},
					{
						foo: 'bar-1',
						exe_0: 'id-1-1',
						fooBar: 'id-2-1',
						eins: 'zwei-2',
						hello: 'world-1'
					},
					{
						foo: 'bar-1',
						exe_0: 'id-1-1',
						fooBar: 'id-2-1',
						eins: 'zwei-2',
						hello: 'world-2'
					},
					{
						foo: 'bar-2',
						exe_0: 'id-1-1',
						fooBar: 'id-2-2',
						eins: 'zwei-1',
						hello: 'world-1'
					},
					{
						foo: 'bar-2',
						exe_0: 'id-1-1',
						fooBar: 'id-2-2',
						eins: 'zwei-1',
						hello: 'world-2'
					},
					{
						foo: 'bar-2',
						exe_0: 'id-1-1',
						fooBar: 'id-2-2',
						eins: 'zwei-2',
						hello: 'world-1'
					},
					{
						foo: 'bar-2',
						exe_0: 'id-1-1',
						fooBar: 'id-2-2',
						eins: 'zwei-2',
						hello: 'world-2'
					},
					{
						foo: 'bar-3',
						exe_0: 'id-1-2',
						fooBar: 'id-2-1',
						eins: 'zwei-1',
						hello: 'world-1'
					},
					{
						foo: 'bar-3',
						exe_0: 'id-1-2',
						fooBar: 'id-2-1',
						eins: 'zwei-1',
						hello: 'world-2'
					},
					{
						foo: 'bar-3',
						exe_0: 'id-1-2',
						fooBar: 'id-2-1',
						eins: 'zwei-2',
						hello: 'world-1'
					},
					{
						foo: 'bar-3',
						exe_0: 'id-1-2',
						fooBar: 'id-2-1',
						eins: 'zwei-2',
						hello: 'world-2'
					}
				]);
			});
		});

		describe('::toJSON', function () {
			it('should work', async function () {
				const exe = new sut.Querier('examp-5', query);

				expect(exe.toJSON()).to.deep.equal([
					{
						method: 'read',
						models: [
							{
								series: 'b',
								schema: 'schemaB',
								joins: []
							}
						],
						fields: [
							{
								series: 'b',
								path: 'cId',
								as: 'fooBar'
							},
							{
								series: 'b',
								path: 'aId',
								as: 'exe_0'
							}
						],
						filters: [
							{
								series: 'b',
								path: 'param2',
								operation: '=',
								value: 456,
								settings: {}
							}
						],
						params: [
							{
								series: 'b',
								path: 'param3',
								operation: '=',
								value: 567,
								settings: {}
							}
						],
						sourceName: 's-2',
						externals: []
					},
					{
						method: 'read',
						models: [
							{
								series: 'a',
								schema: 'schemaA',
								joins: []
							}
						],
						fields: [],
						filters: [
							{
								series: 'a',
								path: 'param1',
								operation: '=',
								value: 123,
								settings: {}
							}
						],
						params: [],
						sourceName: 's-1',
						externals: [
							{
								name: 'a',
								mappings: [
									{
										from: 'exe_0',
										to: 'id',
										temp: true
									}
								]
							}
						]
					},
					{
						method: 'read',
						models: [
							{
								series: 'c',
								schema: 'schemaC',
								joins: []
							}
						],
						fields: [],
						filters: [],
						params: [
							{
								series: 'c',
								path: 'param4',
								operation: '=',
								value: 890,
								settings: {}
							}
						],
						sourceName: 's-3',
						externals: [
							{
								name: 'c',
								mappings: [
									{
										from: 'fooBar',
										to: 'id',
										temp: false
									}
								]
							}
						]
					}
				]);
			});
		});
	});
});
