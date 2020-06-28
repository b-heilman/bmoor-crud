
const {expect} = require('chai');

describe('src/interfaces/knex.js', function(){
	const sut = require('./knex.js');

	describe('::translateSelect', function(){
		it('should translate a basic query', function(){
			const stmt = {
				method: 'read',
				models: [{
					name: 'model-1',
					fields: [{
						path: 'id'
					}, {
						path: 'name'
					}, {
						path: 'title'
					}, {
						path: 'json'
					}],
					query: {
						id: 123
					}
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
				\`model-1\` AS \`model-1\`
			`.replace(/\s+/g, ''));

			expect(res.where.replace(/\s+/g, ''))
			.to.equal(`
				\`model-1\`.\`id\` = ??
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
					name: 'model-1',
					fields: [{
						path: 'id'
					}, {
						path: 'name'
					}, {
						path: 'title'
					}, {
						path: 'json'
					}],
					query: null
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
				\`model-1\` AS \`model-1\`
			`.replace(/\s+/g, ''));

			expect(res.where)
			.to.equal(null);

			expect(res.params)
			.to.deep.equal([]);
		});

		it('should handle an empty query', function(){
			const stmt = {
				method: 'read',
				models: [{
					name: 'model-1',
					fields: [{
						path: 'id',
						as: 'key'
					}, {
						path: 'name'
					}, {
						path: 'title'
					}, {
						path: 'json'
					}],
					query: {}
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
				'models': [
					{
						'name': 'test-item',
						'fields': [
							{
								'path': 'name',
								'as': 'test-item_0'
							}
						],
						'query': {
							'id': 1
						},
						'schema': 'foo-bar'
					},
					{
						'name': 'test-person',
						'fields': [
							{
								'path': 'name',
								'as': 'test-person_1'
							}
						],
						'query': {
							foo: 'bar'
						},
						join: {
							on: [{
								name: 'test-item',
								remote: 'id',
								local: 'itemId'
							}]
						}
					},
					{
						'name': 'test-category',
						'fields': [
							{
								'path': 'name',
								'as': 'test-category_2'
							},
							{
								'path': 'fooId',
								'as': 'test-category_3'
							}
						],
						'query': null,
						join: {
							on: [{
								name: 'test-item',
								remote: 'id',
								local: 'itemId'
							}]
						}
					}
				]
			};

			const res = sut.translateSelect(stmt);

			expect(res.select.replace(/\s+/g, ''))
			.to.equal(`
				\`test-item\`.\`name\` AS \`test-item_0\`, 
				\`test-person\`.\`name\` AS \`test-person_1\`,
				\`test-category\`.\`name\` AS \`test-category_2\`,
				\`test-category\`.\`fooId\` AS \`test-category_3\`
			`.replace(/\s+/g, ''));

			expect(res.from.replace(/\s+/g, ''))
			.to.equal(`
				\`foo-bar\` AS \`test-item\`
					INNER JOIN \`test-person\` AS \`test-person\`
						ON \`test-person\`.\`itemId\` = \`test-item\`.\`id\`
					INNER JOIN \`test-category\` AS \`test-category\`
						ON \`test-category\`.\`itemId\` = \`test-item\`.\`id\`
			`.replace(/\s+/g, ''));

			expect(res.where.replace(/\s+/g, ''))
			.to.equal(`
				\`test-item\`.\`id\`=??
					AND \`test-person\`.\`foo\`=??
			`.replace(/\s+/g, ''));

			expect(res.params)
			.to.deep.equal([
				1,
				'bar'
			]);
		});
	});
});
