
const {expect} = require('chai');

const sut = require('./query.js');

describe('src/schema/query.js', function(){
	describe('sorting', function(){
		it('should work with one', function(){
			const query = new sut.Query('a');

			query.setSchema('a', 'schemaA');

			expect(query.toJSON().models.map(model => model.series))
			.to.deep.equal(['a']);
		});

		it('should work with two', function(){
			const query = new sut.Query('a');

			query.setSchema('a', 'schemaA');
			query.setSchema('b', 'schemaB');

			query.addJoins('b', [new sut.QueryJoin('a', [])]);

			expect(query.toJSON().models.map(model => model.series))
			.to.deep.equal(['a', 'b']);
		});

		it('should work with three direct', function(){
			const query = new sut.Query('a');

			query.setSchema('a', 'schemaA');
			query.setSchema('b', 'schemaB');
			query.setSchema('c', 'schemaC');

			query.addJoins('b', [new sut.QueryJoin('a', [])]);
			query.addJoins('c', [new sut.QueryJoin('b', [])]);

			expect(query.toJSON().models.map(model => model.series))
			.to.deep.equal(['a', 'b', 'c']);
		});

		it('should work with three direct, even if tail is root', function(){
			const query = new sut.Query('c');

			query.setSchema('a', 'schemaA');
			query.setSchema('b', 'schemaB');
			query.setSchema('c', 'schemaC');

			query.addJoins('b', [new sut.QueryJoin('a', [])]);
			query.addJoins('c', [new sut.QueryJoin('b', [])]);

			expect(query.toJSON().models.map(model => model.series))
			.to.deep.equal(['c', 'b', 'a']);
		});

		it('should work with three direct, as siblings', function(){
			const query = new sut.Query('a');

			query.setSchema('a', 'schemaA');
			query.setSchema('b', 'schemaB');
			query.setSchema('c', 'schemaC');

			query.addJoins('b', [new sut.QueryJoin('a', [])]);
			query.addJoins('c', [new sut.QueryJoin('a', [])]);

			expect(query.toJSON().models.map(model => model.series))
			.to.deep.equal(['a', 'b', 'c']);
		});

		it('should work with two tail pairs', function(){
			const query = new sut.Query('a');

			query.setSchema('a', 'schemaA');
			query.setSchema('b', 'schemaB');
			query.setSchema('c', 'schemaC');
			query.setSchema('d', 'schemaD');
			query.setSchema('e', 'schemaE');

			query.addJoins('b', [new sut.QueryJoin('a', [])]);
			query.addJoins('c', [new sut.QueryJoin('a', [])]);
			query.addJoins('d', [new sut.QueryJoin('b', [])]);
			query.addJoins('e', [new sut.QueryJoin('c', [])]);

			expect(query.toJSON().models.map(model => model.series))
			.to.deep.equal(['a', 'b', 'c', 'd', 'e']);
		});

		it('should work with two tail pairs, insertion should not matter', function(){
			const query = new sut.Query('a');

			query.setSchema('e', 'schemaE');
			query.setSchema('d', 'schemaD');
			query.setSchema('c', 'schemaC');
			query.setSchema('a', 'schemaA');
			query.setSchema('b', 'schemaB');

			query.addJoins('b', [new sut.QueryJoin('a', [])]);
			query.addJoins('e', [new sut.QueryJoin('a', [])]);
			query.addJoins('d', [new sut.QueryJoin('b', [])]);
			query.addJoins('c', [new sut.QueryJoin('e', [])]);

			expect(query.toJSON().models.map(model => model.series))
			.to.deep.equal(['a', 'e', 'b', 'd', 'c']);
		});
	});

	describe('composition', function(){
		it('should correctly compile all the operations and keep in order', function(){
			const query = new sut.Query('a');

			query.setSchema('a', 'schemaA');
			query.setSchema('c', 'schemaC');
			query.setSchema('b', 'schemaB');

			query.addJoins('b', [new sut.QueryJoin('a', [{from:'aId', to:'id'}])]);
			query.addJoins('c', [new sut.QueryJoin('b', [{from: 'bId', to:'id'}])]);
			query.addJoins('b', [new sut.QueryJoin('a', [{from: '---', to:'----'}])]);

			query.addFields('a', [new sut.QueryField('hello.world')]);
			query.addFields('b', [new sut.QueryField('foo.bar', 'test')]);
			query.addFields('c', [new sut.QueryField('eins', 'zwei')]);

			query.addParams('a', [new sut.QueryParam('param1', 123)]);
			query.addParams('b', [new sut.QueryParam('param2', '456')]);
			query.addParams('c', [new sut.QueryParam('param3', [1,2], '=')]);

			expect(query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'a',
					schema: 'schemaA',
					joins: []
				}, {
					series: 'b',
					schema: 'schemaB',
					joins: [{
						name: 'a',
						optional: false,
						mappings: [{
							from: 'aId',
							to: 'id'
						}]
					}]
				}, {
					series: 'c',
					schema: 'schemaC',
					joins: [{
						name: 'b',
						optional: false,
						mappings: [{
							from: 'bId',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'a',
					path: 'hello.world',
					as: null
				},{
					series: 'b',
					path: 'foo.bar',
					as: 'test'
				},{
					series: 'c',
					path: 'eins',
					as: 'zwei'
				}],
				params: [{
					series: 'a',
					path: 'param1',
					operation: '=',
					value: 123,
					settings: {}
				},{
					series: 'b',
					path: 'param2',
					operation: '=',
					value: '456',
					settings: {}
				},{
					series: 'c',
					path: 'param3',
					operation: '=',
					value: [1,2],
					settings: {}
				}]
			});
		});


		it('should fix a query that has two 0 joins', function(){
			const query = new sut.Query('a');

			query.setSchema('a', 'schemaA');
			query.setSchema('c', 'schemaC');
			query.setSchema('b', 'schemaB');

			query.addJoins('b', [
				new sut.QueryJoin('a', [{from:'aId', to:'id'}]),
				new sut.QueryJoin('c', [{from:'cId', to:'id'}])
			]);

			expect(query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'a',
					schema: 'schemaA',
					joins: []
				}, {
					series: 'b',
					schema: 'schemaB',
					joins: [{
						name: 'a',
						optional: false,
						mappings: [{
							from: 'aId',
							to: 'id'
						}]
					}]
				}, {
					series: 'c',
					schema: 'schemaC',
					joins: [{
						name: 'b',
						optional: false,
						mappings: [{
							from: 'id',
							to: 'cId'
						}]
					}]
				}],
				fields: [],
				params: []
			});
		});
	});
});
