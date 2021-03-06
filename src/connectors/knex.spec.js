
const sinon = require('sinon');
const {expect} = require('chai');

const {Query, QueryParam, QueryField, QueryJoin, QueryPosition, QuerySort} = require('../schema/query.js');

describe('src/interfaces/knex.js', function(){
	const sut = require('./knex.js');

	describe('::translateSelect', function(){
		it('should translate a basic query', function(){
			const stmt = {
				method: 'read',
				query: (new Query('model-1'))
				.addFields('model-1', [
					new QueryField('id'),
					new QueryField('name'),
					new QueryField('title'),
					new QueryField('json')
				])
				.addParams('model-1', [
					new QueryParam('id', 123)
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
					new QueryField('id'),
					new QueryField('name'),
					new QueryField('title'),
					new QueryField('json')
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
					new QueryField('id', 'key'),
					new QueryField('name'),
					new QueryField('title'),
					new QueryField('json')
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
				.setSchema('test-item', 'foo-bar')
				.addFields('test-item', [
					new QueryField('name', 'test-item_0')
				])
				.addParams('test-item', [
					new QueryParam('id', 1)
				])
				.addFields('test-person', [
					new QueryField('name', 'test-person_1')
				])
				.addParams('test-person', [
					new QueryParam('foo', 'bar')
				])
				.addJoins('test-person', [
					new QueryJoin('test-item', [{from:'itemId', to:'id'}])
				])
				.addFields('test-category', [
					new QueryField('name'),
					new QueryField('fooId')
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

	describe('::connector.execute', function(){
		let stubs = null;

		beforeEach(function(){
			stubs = {};

			stubs.raw = sinon.stub()
				.resolves('ok');

			sut.config.set('knex', {
				raw: stubs.raw
			});
		});

		it('should translate with a sort', async function(){
			const stmt = {
				method: 'read',
				query: (new Query('model-1'))
				.addFields('model-1', [
					new QueryField('id'),
					new QueryField('name')
				])
				.addParams('model-1', [
					new QueryParam('id', 123)
				])
				.setSorts([
					new QuerySort('foo', 'bar', true), 
					new QuerySort('hello', 'world', false)
				])
			};

			await sut.connector.execute(stmt);

			expect(stubs.raw.getCall(0).args[0].replace(/\s+/g, ''))
			.to.deep.equal(`
				SELECT \`model-1\`.\`id\`, \`model-1\`.\`name\`
				FROM \`model-1\` AS \`model-1\`
    			WHERE \`model-1\`.\`id\`=?
    			ORDER BY \`foo\`.\`bar\` ASC,\`hello\`.\`world\` DESC`
    			.replace(/\s+/g, '')
    		);
		});

		it('should translate with a limit', async function(){
			const stmt = {
				method: 'read',
				query: (new Query('model-1'))
				.addFields('model-1', [
					new QueryField('id'),
					new QueryField('name')
				])
				.addParams('model-1', [
					new QueryParam('id', 123)
				])
				.setPosition(new QueryPosition(0,10))
			};

			await sut.connector.execute(stmt);

			expect(stubs.raw.getCall(0).args[0].replace(/\s+/g, ''))
			.to.deep.equal(`
				SELECT \`model-1\`.\`id\`, \`model-1\`.\`name\`
				FROM \`model-1\` AS \`model-1\`
    			WHERE \`model-1\`.\`id\`=?
    			LIMIT 10`
    			.replace(/\s+/g, '')
    		);
		});

		it('should translate with a sort and limit', async function(){
			const stmt = {
				method: 'read',
				query: (new Query('model-1'))
				.addFields('model-1', [
					new QueryField('id'),
					new QueryField('name')
				])
				.addParams('model-1', [
					new QueryParam('id', 123)
				])
				.setSorts([
					new QuerySort('foo', 'bar', true), 
					new QuerySort('hello', 'world', false)
				])
				.setPosition(new QueryPosition(0,10))
			};

			await sut.connector.execute(stmt);

			expect(stubs.raw.getCall(0).args[0].replace(/\s+/g, ''))
			.to.deep.equal(`
				SELECT \`model-1\`.\`id\`, \`model-1\`.\`name\`
				FROM \`model-1\` AS \`model-1\`
    			WHERE \`model-1\`.\`id\`=?
    			ORDER BY \`foo\`.\`bar\` ASC,\`hello\`.\`world\` DESC
    			LIMIT 10`
    			.replace(/\s+/g, '')
    		);
		});
	});
});
