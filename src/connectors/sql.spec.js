const {expect} = require('chai');

describe('src/interfaces/knex.js', function () {
	const sut = require('./sql.js');

	describe('::translateSelect', function(){
		it('should translate a basic query', function(){
			const stmt = {
				method: 'read',
				models: [{
					series: 'model-1',
					schema: 'schema-1',
					joins: []
				}],
				fields: [{
					series: 'model-1',
					path: 'id',
					as: null
				}, {
					series: 'model-1',
					path: 'name'
				}, {
					series: 'model-1',
					path: 'title'
				}, {
					series: 'model-1',
					path: 'json'
				}],
				filters: [],
				params: [{
					series: 'model-1',
					path: 'id',
					operation: '=',
					value: 123
				}]
			};

			const res = sut.translateSelect(stmt);

			expect(res.select.replace(/\s+/g, ''))
			.to.equal(`
				\`model-1\`.\`id\`, 
				\`model-1\`.\`name\`,
				\`model-1\`.\`title\`,
				\`model-1\`.\`json\`
			`.replace(/\s+/g, ''));

			expect(res.from.replace(/\s+/g, ''))
			.to.equal(`
				\`schema-1\` AS \`model-1\`
			`.replace(/\s+/g, ''));

			expect(res.where.replace(/\s+/g, ''))
			.to.equal(`
				\`model-1\`.\`id\` = ?
			`.replace(/\s+/g, ''));

			expect(res.params)
			.to.deep.equal([
				123
			]);
		});

		it('should handle a null query', function(){
			const stmt = {
				method: 'read',
				models: [{
					series: 'model-1',
					schema: 'schema-1',
					joins: []
				}],
				fields: [{
					series: 'model-1',
					path: 'id',
					as: null
				}, {
					series: 'model-1',
					path: 'name'
				}, {
					series: 'model-1',
					path: 'title'
				}, {
					series: 'model-1',
					path: 'json'
				}],
				filters: [],
				params: []
			};

			const res = sut.translateSelect(stmt);

			expect(res.select.replace(/\s+/g, ''))
			.to.equal(`
				\`model-1\`.\`id\`, 
				\`model-1\`.\`name\`,
				\`model-1\`.\`title\`,
				\`model-1\`.\`json\`
			`.replace(/\s+/g, ''));

			expect(res.from.replace(/\s+/g, ''))
			.to.equal(`
				\`model-1\` AS \`model-1\`
			`.replace(/\s+/g, ''));

			expect(res.where)
			.to.equal(null);

			expect(res.params)
			.to.deep.equal([]);
		});

		it('should handle aliases', function(){
			const stmt = {
				method: 'read',
				models: [{
					series: 'model-1',
					schema: 'schema-1',
					joins: []
				}],
				fields: [{
					series: 'model-1',
					path: 'id',
					as: 'key'
				}, {
					series: 'model-1',
					path: 'name'
				}, {
					series: 'model-1',
					path: 'title'
				}, {
					series: 'model-1',
					path: 'json'
				}],
				filters: [],
				params: [{
					series: 'model-1',
					path: 'id',
					operation: '=',
					value: 123
				}]
			};

			const res = sut.translateSelect(stmt);

			expect(res.select.replace(/\s+/g, ''))
			.to.equal(`
				\`model-1\`.\`id\` AS \`key\`, 
				\`model-1\`.\`name\`,
				\`model-1\`.\`title\`,
				\`model-1\`.\`json\`
			`.replace(/\s+/g, ''));

			expect(res.from.replace(/\s+/g, ''))
			.to.equal(`
				\`model-1\` AS \`model-1\`
			`.replace(/\s+/g, ''));

			expect(res.where)
			.to.equal(null);

			expect(res.params)
			.to.deep.equal([]);
		});

		it('should translate a complex query', function(){
			const stmt = {
				'method': 'read',
				models: [
					{
						series: 'test-item',
						schema: 'foo-bar',
						joins: []
					},
					{
						series: 'test-person',
						schema: 'test-person',
						joins: [
							{
								name: 'test-item',
								optional: false,
								mappings: [
									{
										from: 'itemId',
										to: 'id'
									}
								]
							}
						]
					},
					{
						series: 'test-category',
						schema: 'test-category',
						joins: [
							{
								name: 'test-item',
								optional: true,
								mappings: [
									{
										from: 'itemId',
										to: 'id'
									}
								]
							}
						]
					}
				],
				fields: [{
					series: 'test-item',
					path: 'name',
					as: 'test-item_0'
				}, {
					series: 'test-person',
					path: 'name',
					as: 'test-item_0'
				}, {
					series: 'test-category',
					path: 'name'
				}, {
					series: 'test-category',
					path: 'fooId'
				}],
				filters: [],
				params: [{
					series: 'test-item',
					path: 'id',
					operation: '=',
					value: 1,
					settings: {}
				}, {
					series: 'test-person_1',
					path: 'foo',
					operation: '=',
					value: 'bar',
					settings: {}
				}]
			};

			const res = sut.translateSelect(stmt);

			expect(res.select.replace(/\s+/g, ''))
			.to.equal(`
				\`test-item\`.\`name\` AS \`test-item_0\`, 
				\`test-person\`.\`name\` AS \`test-person_1\`,
				\`test-category\`.\`name\`,
				\`test-category\`.\`fooId\`
			`.replace(/\s+/g, ''));

			expect(res.from.replace(/\s+/g, ''))
			.to.equal(`
				\`foo-bar\` AS \`test-item\`
					INNER JOIN \`test-person\` AS \`test-person\`
						ON \`test-person\`.\`itemId\` = \`test-item\`.\`id\`
					LEFT JOIN \`test-category\` AS \`test-category\`
						ON \`test-category\`.\`itemId\` = \`test-item\`.\`id\`
			`.replace(/\s+/g, ''));

			expect(res.where.replace(/\s+/g, ''))
			.to.equal(`
				\`test-item\`.\`id\`=?
					AND \`test-person\`.\`foo\`=?
			`.replace(/\s+/g, ''));

			expect(res.params)
			.to.deep.equal([
				1,
				'bar'
			]);
		});
	});
});
