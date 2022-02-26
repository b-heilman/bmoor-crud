const sinon = require('sinon');
const {expect} = require('chai');

describe('src/connectors/sql.js', function () {
	const sut = require('./sql.js');

	const {QueryStatement} = require('../schema/query/statement.js');
	const {StatementVariable} = require('../schema/statement/variable.js');
	const {StatementField} = require('../schema/statement/field.js');
	const {QueryJoin} = require('../schema/query/join.js');

	describe('::translateSelect', function () {
		let stubs = null;

		let connector = null;

		beforeEach(function () {
			stubs = {};

			connector = sut.factory(stubs);

			stubs.run = sinon.stub().resolves('ok');
		});

		it('should translate a basic query', async function () {
			const stmt = new QueryStatement('model-1')
				.addFields('model-1', [
					new StatementField('id'),
					new StatementField('name'),
					new StatementField('title'),
					new StatementField('json')
				])
				.addParam(new StatementVariable('model-1', 'id', 123));

			await connector.execute(stmt);

			expect(stubs.run.getCall(0).args[0].replace(/\s+/g, '')).to.deep.equal(
				`
				SELECT \`model-1\`.\`id\`,\`model-1\`.\`name\`,\`model-1\`.\`title\`,\`model-1\`.\`json\`
				FROM \`model-1\` AS \`model-1\`
    			WHERE \`model-1\`.\`id\`=?`.replace(
					/\s+/g,
					''
				)
			);

			expect(stubs.run.getCall(0).args[1]).to.deep.equal([
				123
			]);
		});

		it('should handle a null query', async function () {
			const stmt = new QueryStatement('model-1').addFields('model-1', [
				new StatementField('id'),
				new StatementField('name'),
				new StatementField('title'),
				new StatementField('json')
			]);

			await connector.execute(stmt);

			expect(stubs.run.getCall(0).args[0].replace(/\s+/g, '')).to.deep.equal(
				`
				SELECT \`model-1\`.\`id\`,\`model-1\`.\`name\`,\`model-1\`.\`title\`,\`model-1\`.\`json\`
				FROM \`model-1\` AS \`model-1\``.replace(
					/\s+/g,
					''
				)
			);

			expect(stubs.run.getCall(0).args[1]).to.deep.equal([]);
		});

		it('should handle aliases', async function () {
			const stmt = new QueryStatement('model-1').addFields('model-1', [
				new StatementField('id', 'key'),
				new StatementField('name'),
				new StatementField('title'),
				new StatementField('json')
			]);

			await connector.execute(stmt);

			expect(stubs.run.getCall(0).args[0].replace(/\s+/g, '')).to.equal(
				`SELECT
				\`model-1\`.\`id\` AS \`key\`, 
				\`model-1\`.\`name\`,
				\`model-1\`.\`title\`,
				\`model-1\`.\`json\`
				FROM
				\`model-1\` AS \`model-1\`
			`.replace(/\s+/g, '')
			);

			expect(stubs.run.getCall(0).args[1]).to.deep.equal([]);
		});

		it('should translate a complex query', async function () {
			const stmt = new QueryStatement('test-item')
				.setModel('test-item', {schema: 'foo-bar'})
				.addJoins('test-person', [
					new QueryJoin('test-item', [{from: 'itemId', to: 'id'}])
				])
				.addJoins('test-category', [
					new QueryJoin('test-item', [{from: 'itemId', to: 'id'}], true)
				])
				.addFields('test-item', [new StatementField('name', 'test-item_0')])
				.addFields('test-person', [new StatementField('name', 'test-person_1')])
				.addFields('test-category', [
					new StatementField('name'),
					new StatementField('fooId')
				])
				.addParam(new StatementVariable('test-item', 'id', 1))
				.addParam(new StatementVariable('test-person', 'foo', 'bar'));

			await connector.execute(stmt);

			expect(stubs.run.getCall(0).args[0].replace(/\s+/g, '')).to.equal(
				`SELECT
				\`test-item\`.\`name\` AS \`test-item_0\`, 
				\`test-person\`.\`name\` AS \`test-person_1\`,
				\`test-category\`.\`name\`,
				\`test-category\`.\`fooId\`
				FROM
				\`foo-bar\` AS \`test-item\`
					INNER JOIN \`test-person\` AS \`test-person\`
						ON \`test-person\`.\`itemId\` = \`test-item\`.\`id\`
					LEFT JOIN \`test-category\` AS \`test-category\`
						ON \`test-category\`.\`itemId\` = \`test-item\`.\`id\`
				WHERE
				\`test-item\`.\`id\`=?
					AND \`test-person\`.\`foo\`=?
			`.replace(/\s+/g, '')
			);

			expect(stubs.run.getCall(0).args[1]).to.deep.equal([1, 'bar']);
		});
	});
});
