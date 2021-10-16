
// const {expect} = require('chai');

xdescribe('src/interfaces/knex.js', function(){
	/*
	const sut = require('./sql.js');

	const {Query, StatementParam, StatementField, QueryJoin} = require('../schema/query.js');

	describe('::translateSelect', function(){
		it('should translate a basic query', function(){
			const stmt = {
				method: 'read',
				query: (new Query('model-1'))
				.addFields('model-1', [
					new StatementField('id'),
					new StatementField('name'),
					new StatementField('title'),
					new StatementField('json')
				])
				.addParams('model-1', [
					new StatementParam('id', 123)
				])
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
				query: (new Query('model-1'))
				.addFields('model-1', [
					new StatementField('id'),
					new StatementField('name'),
					new StatementField('title'),
					new StatementField('json')
				])
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
				query: (new Query('model-1'))
				.addFields('model-1', [
					new StatementField('id', 'key'),
					new StatementField('name'),
					new StatementField('title'),
					new StatementField('json')
				])
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
				query: (new Query('test-item'))
				.setModel('test-item', {schema:'foo-bar'})
				.addFields('test-item', [
					new StatementField('name', 'test-item_0')
				])
				.addParams('test-item', [
					new StatementParam('id', 1)
				])
				.addFields('test-person', [
					new StatementField('name', 'test-person_1')
				])
				.addParams('test-person', [
					new StatementParam('foo', 'bar')
				])
				.addJoins('test-person', [
					new QueryJoin('test-item', [{from:'itemId', to:'id'}])
				])
				.addFields('test-category', [
					new StatementField('name'),
					new StatementField('fooId')
				])
				.addJoins('test-category', [
					new QueryJoin('test-item', [{from:'itemId', to:'id'}], true)
				])
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
	*/
});
