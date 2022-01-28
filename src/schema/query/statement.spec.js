const {expect} = require('chai');

const sut = require('./statement.js');

const {StatementVariable} = require('../statement/variable.js');
const {StatementField} = require('../statement/field.js');
const {StatementExpression, joiners} = require('../statement/expression.js');
const {QueryJoin} = require('./join.js');
const {QuerySort} = require('./sort.js');

describe('src/schema/query.js', function () {
	describe('::toJSON', function () {
		it('should work with one', function () {
			const query = new sut.QueryStatement('a');

			query.setModel('a', {schema: 'schemaA'});

			expect(query.toJSON().models.map((model) => model.series)).to.deep.equal([
				'a'
			]);
		});

		it('should work with two', function () {
			const query = new sut.QueryStatement('a');

			query.setModel('a', {schema: 'schemaA'});
			query.setModel('b', {schema: 'schemaB'});

			query.addJoins('b', [new QueryJoin('a', [])]);

			expect(query.toJSON().models.map((model) => model.series)).to.deep.equal([
				'a',
				'b'
			]);
		});

		it('should work with three direct', function () {
			const query = new sut.QueryStatement('a');

			query.setModel('a', {schema: 'schemaA'});
			query.setModel('b', {schema: 'schemaB'});
			query.setModel('c', {schema: 'schemaC'});

			query.addJoins('b', [new QueryJoin('a', [])]);
			query.addJoins('c', [new QueryJoin('b', [])]);

			expect(query.toJSON().models.map((model) => model.series)).to.deep.equal([
				'a',
				'b',
				'c'
			]);
		});

		it('should work with three direct, even if tail is root', function () {
			const query = new sut.QueryStatement('c');

			query.setModel('a', {schema: 'schemaA'});
			query.setModel('b', {schema: 'schemaB'});
			query.setModel('c', {schema: 'schemaC'});

			query.addJoins('b', [new QueryJoin('a', [])]);
			query.addJoins('c', [new QueryJoin('b', [])]);

			expect(query.toJSON().models.map((model) => model.series)).to.deep.equal([
				'c',
				'b',
				'a'
			]);
		});

		it('should work with three direct, as siblings', function () {
			const query = new sut.QueryStatement('a');

			query.setModel('a', {schema: 'schemaA'});
			query.setModel('b', {schema: 'schemaB'});
			query.setModel('c', {schema: 'schemaC'});

			query.addJoins('b', [new QueryJoin('a', [])]);
			query.addJoins('c', [new QueryJoin('a', [])]);

			expect(query.toJSON().models.map((model) => model.series)).to.deep.equal([
				'a',
				'b',
				'c'
			]);
		});

		it('should work with two tail pairs', function () {
			const query = new sut.QueryStatement('a');

			query.setModel('a', {schema: 'schemaA'});
			query.setModel('b', {schema: 'schemaB'});
			query.setModel('c', {schema: 'schemaC'});
			query.setModel('d', {schema: 'schemaD'});
			query.setModel('e', {schema: 'schemaE'});

			query.addJoins('b', [new QueryJoin('a', [])]);
			query.addJoins('c', [new QueryJoin('a', [])]);
			query.addJoins('d', [new QueryJoin('b', [])]);
			query.addJoins('e', [new QueryJoin('c', [])]);

			expect(query.toJSON().models.map((model) => model.series)).to.deep.equal([
				'a',
				'b',
				'c',
				'd',
				'e'
			]);
		});

		it('should work with two tail pairs, insertion should not matter', function () {
			const query = new sut.QueryStatement('a');

			query.setModel('e', {schema: 'schemaE'});
			query.setModel('d', {schema: 'schemaD'});
			query.setModel('c', {schema: 'schemaC'});
			query.setModel('a', {schema: 'schemaA'});
			query.setModel('b', {schema: 'schemaB'});

			query.addJoins('b', [new QueryJoin('a', [])]);
			query.addJoins('e', [new QueryJoin('a', [])]);
			query.addJoins('d', [new QueryJoin('b', [])]);
			query.addJoins('c', [new QueryJoin('e', [])]);

			expect(query.toJSON().models.map((model) => model.series)).to.deep.equal([
				'a',
				'e',
				'b',
				'd',
				'c'
			]);
		});
	});

	describe('composition', function () {
		it('should correctly compile all the operations and keep in order', function () {
			const query = new sut.QueryStatement('a');

			query.setModel('a', {schema: 'schemaA'});
			query.setModel('c', {schema: 'schemaC'});
			query.setModel('b', {schema: 'schemaB'});

			query.addJoins('b', [new QueryJoin('a', [{from: 'aId', to: 'id'}])]);
			query.addJoins('c', [new QueryJoin('b', [{from: 'bId', to: 'id'}])]);
			query.addJoins('b', [new QueryJoin('a', [{from: '---', to: '----'}])]);

			query.addFields('a', [new StatementField('hello.world')]);
			query.addFields('b', [new StatementField('foo.bar', 'test')]);
			query.addFields('c', [new StatementField('eins', 'zwei')]);

			query.addFilter(new StatementVariable('a', 'param1', 123));
			query.addFilter(new StatementVariable('b', 'param2', '456'));
			query.addFilter(new StatementVariable('c', 'param3', [1, 2], '='));

			query.addParam(new StatementVariable('a', 'param1', 123));
			query.addParam(new StatementVariable('b', 'param2', '456'));
			query.addParam(new StatementVariable('c', 'param3', [1, 2], '='));

			query.addSort(new QuerySort('a', 'unos'));
			query.addSort(new QuerySort('c', 'dos', true));
			query.addSort(new QuerySort('b', 'tres', false));

			expect(query.toJSON()).to.deep.equal({
				method: 'read',
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
										from: 'bId',
										to: 'id'
									}
								]
							}
						]
					}
				],
				fields: [
					{
						series: 'a',
						path: 'hello.world',
						as: null
					},
					{
						series: 'b',
						path: 'foo.bar',
						as: 'test'
					},
					{
						series: 'c',
						path: 'eins',
						as: 'zwei'
					}
				],
				filters: {
					join: 'and',
					expressables: [
						{
							series: 'a',
							path: 'param1',
							operation: '=',
							value: 123,
							settings: {}
						},
						{
							series: 'b',
							path: 'param2',
							operation: '=',
							value: '456',
							settings: {}
						},
						{
							series: 'c',
							path: 'param3',
							operation: '=',
							value: [1, 2],
							settings: {}
						}
					]
				},
				params: {
					join: 'and',
					expressables: [
						{
							series: 'a',
							path: 'param1',
							operation: '=',
							value: 123,
							settings: {}
						},
						{
							series: 'b',
							path: 'param2',
							operation: '=',
							value: '456',
							settings: {}
						},
						{
							series: 'c',
							path: 'param3',
							operation: '=',
							value: [1, 2],
							settings: {}
						}
					]
				},
				sorts: [
					{
						series: 'a',
						path: 'unos',
						ascending: true
					},
					{
						series: 'c',
						path: 'dos',
						ascending: true
					},
					{
						series: 'b',
						path: 'tres',
						ascending: false
					}
				]
			});
		});

		it('should fix a query that has two 0 joins', function () {
			const query = new sut.QueryStatement('a');

			query.setModel('a', {
				schema: 'schemaA',
				incomingSettings: {source: 'eins'}
			});
			query.setModel('c', {
				schema: 'schemaC',
				incomingSettings: {source: 'eins'}
			});
			query.setModel('b', {
				schema: 'schemaB',
				incomingSettings: {source: 'eins'}
			});

			const expression1 = new StatementExpression();
			expression1.addExpressable(
				new StatementVariable('a', 'param1', 100, 'gt')
			);
			expression1.addExpressable(
				new StatementVariable('a', 'param1', 125, 'lt')
			);
			query.addFilter(expression1);

			const expression2 = new StatementExpression();
			expression2.addExpressable(new StatementVariable('b', 'param2', 200));
			expression2.addExpressable(new StatementVariable('b', 'param3', 300));
			expression2.setJoin(joiners.or);
			query.addParam(expression2);

			query.addJoins('b', [
				new QueryJoin('a', [{from: 'aId', to: 'id'}]),
				new QueryJoin('c', [{from: 'cId', to: 'id'}])
			]);

			expect(query.toJSON()).to.deep.equal({
				method: 'read',
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
				filters: {
					expressables: [
						{
							expressables: [
								{
									series: 'a',
									path: 'param1',
									operation: 'gt',
									value: 100,
									settings: {}
								},
								{
									series: 'a',
									path: 'param1',
									operation: 'lt',
									value: 125,
									settings: {}
								}
							],
							join: 'and'
						}
					],
					join: 'and'
				},
				params: {
					expressables: [
						{
							expressables: [
								{
									series: 'b',
									path: 'param2',
									operation: '=',
									value: 200,
									settings: {}
								},
								{
									series: 'b',
									path: 'param3',
									operation: '=',
									value: 300,
									settings: {}
								}
							],
							join: 'or'
						}
					],
					join: 'and'
				}
			});
		});
	});
});
