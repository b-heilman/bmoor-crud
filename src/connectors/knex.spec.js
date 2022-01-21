const sinon = require('sinon');
const {expect} = require('chai');

describe('src/interfaces/knex.js', function () {
	const sut = require('./knex.js');

	const {QueryStatement} = require('../schema/query/statement.js');
	const {StatementParam} = require('../schema/statement/param.js');
	const {StatementField} = require('../schema/statement/field.js');
	const {QueryPosition} = require('../schema/query/position.js');
	const {QuerySort} = require('../schema/query/sort.js');
	const {QueryJoin} = require('../schema/query/join.js');

	describe('::connector.execute', function () {
		let stubs = null;

		beforeEach(function () {
			stubs = {};

			stubs.raw = sinon.stub().resolves('ok');

			sut.config.set('knex', {
				raw: stubs.raw
			});
		});

		it('should translate with a sort', async function () {
			const stmt = new QueryStatement('model-1')
				.addFields('model-1', [
					new StatementField('id'),
					new StatementField('name')
				])
				.addParams('model-1', [new StatementParam('id', 123)])
				.addSorts('model-1', [
					new QuerySort('world', 2, false),
					new QuerySort('bar', 1, true)
				]);

			await sut.connector.execute(stmt);

			expect(stubs.raw.getCall(0).args[0].replace(/\s+/g, '')).to.deep.equal(
				`
				SELECT \`model-1\`.\`id\`, \`model-1\`.\`name\`
				FROM \`model-1\` AS \`model-1\`
    			WHERE \`model-1\`.\`id\`=?
    			ORDER BY \`model-1\`.\`bar\` ASC,\`model-1\`.\`world\` DESC`.replace(
					/\s+/g,
					''
				)
			);
		});

		it('should translate with a limit', async function () {
			const stmt = new QueryStatement('model-1')
				.addFields('model-1', [
					new StatementField('id'),
					new StatementField('name')
				])
				.addParams('model-1', [new StatementParam('id', 123)])
				.setPosition(new QueryPosition(0, 10));

			await sut.connector.execute(stmt);

			expect(stubs.raw.getCall(0).args[0].replace(/\s+/g, '')).to.deep.equal(
				`
				SELECT \`model-1\`.\`id\`, \`model-1\`.\`name\`
				FROM \`model-1\` AS \`model-1\`
    			WHERE \`model-1\`.\`id\`=?
    			LIMIT 10`.replace(/\s+/g, '')
			);
		});

		it('should translate with a sort and limit', async function () {
			const stmt = new QueryStatement('model-1')
				.addFields('model-1', [
					new StatementField('id'),
					new StatementField('name')
				])
				.addParams('model-1', [new StatementParam('id', 123)])
				.addJoins('model-2', [
					new QueryJoin('model-1', [{from: 'model1Id', to: 'id'}])
				])
				.addSorts('model-1', [new QuerySort('bar', 1, true)])
				.addSorts('model-2', [new QuerySort('world', 2, false)])
				.setPosition(new QueryPosition(0, 10));

			await sut.connector.execute(stmt);

			expect(stubs.raw.getCall(0).args[0].replace(/\s+/g, '')).to.deep.equal(
				`
				SELECT \`model-1\`.\`id\`, \`model-1\`.\`name\`
				FROM \`model-1\` AS \`model-1\`
    			INNER JOIN \`model-2\` AS \`model-2\`
						ON \`model-2\`.\`model1Id\` = \`model-1\`.\`id\`
    			WHERE \`model-1\`.\`id\`=?
    			ORDER BY \`model-1\`.\`bar\` ASC,\`model-2\`.\`world\` DESC
    			LIMIT 10`.replace(/\s+/g, '')
			);
		});
	});
});
