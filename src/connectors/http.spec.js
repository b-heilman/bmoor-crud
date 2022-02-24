const {expect} = require('chai');
const sinon = require('sinon');

describe('src/connectors/http.js', function () {
	const sut = require('./http.js');

	const {QueryStatement} = require('../schema/query/statement.js');
	const {StatementVariable} = require('../schema/statement/variable.js');
	const {StatementField} = require('../schema/statement/field.js');
	const {QueryJoin} = require('../schema/query/join.js');

	describe('via a factory', function () {
		let operator = null;
		let context = null;

		beforeEach(function(){
			operator = sut.factory({
				base: 'foo.bar.com'
			});

			context = {
				fetch: sinon.stub()
			};
		});

		it.only('should translate a basic query', function () {
			const stmt = new QueryStatement('model-1')
				.addFields('model-1', [
					new StatementField('id'),
					new StatementField('name'),
					new StatementField('title'),
					new StatementField('json')
				])
				.addParam(new StatementVariable('model-1', 'id', 123));

			context.fetch.resolves([{
				foo: 'bar'
			}]);

			operator.exectute(stmt, context);

			const req = context.fetch.getCall(0);
			const url = req.args[0];
			const content = req.args[1];

			console.log('url', url);
			console.log('content', JSON.stringify(content, null, 2));
		});

		it('should handle a null query', function () {
			const stmt = new QueryStatement('model-1').addFields('model-1', [
				new StatementField('id'),
				new StatementField('name'),
				new StatementField('title'),
				new StatementField('json')
			]);

			const res = sut.translateSelect(stmt);

			expect(res.select.replace(/\s+/g, '')).to.equal(
				`
				\`model-1\`.\`id\`, 
				\`model-1\`.\`name\`,
				\`model-1\`.\`title\`,
				\`model-1\`.\`json\`
			`.replace(/\s+/g, '')
			);

			expect(res.from.replace(/\s+/g, '')).to.equal(
				`
				\`model-1\` AS \`model-1\`
			`.replace(/\s+/g, '')
			);

			expect(res.where).to.equal(null);

			expect(res.params).to.deep.equal([]);
		});

		it('should handle aliases', function () {
			const stmt = new QueryStatement('model-1').addFields('model-1', [
				new StatementField('id', 'key'),
				new StatementField('name'),
				new StatementField('title'),
				new StatementField('json')
			]);

			const res = sut.translateSelect(stmt);

			expect(res.select.replace(/\s+/g, '')).to.equal(
				`
				\`model-1\`.\`id\` AS \`key\`, 
				\`model-1\`.\`name\`,
				\`model-1\`.\`title\`,
				\`model-1\`.\`json\`
			`.replace(/\s+/g, '')
			);

			expect(res.from.replace(/\s+/g, '')).to.equal(
				`
				\`model-1\` AS \`model-1\`
			`.replace(/\s+/g, '')
			);

			expect(res.where).to.equal(null);

			expect(res.params).to.deep.equal([]);
		});

		it('should translate a complex query', function () {
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

			const res = sut.translateSelect(stmt);

			expect(res.select.replace(/\s+/g, '')).to.equal(
				`
				\`test-item\`.\`name\` AS \`test-item_0\`, 
				\`test-person\`.\`name\` AS \`test-person_1\`,
				\`test-category\`.\`name\`,
				\`test-category\`.\`fooId\`
			`.replace(/\s+/g, '')
			);

			expect(res.from.replace(/\s+/g, '')).to.equal(
				`
				\`foo-bar\` AS \`test-item\`
					INNER JOIN \`test-person\` AS \`test-person\`
						ON \`test-person\`.\`itemId\` = \`test-item\`.\`id\`
					LEFT JOIN \`test-category\` AS \`test-category\`
						ON \`test-category\`.\`itemId\` = \`test-item\`.\`id\`
			`.replace(/\s+/g, '')
			);

			expect(res.where.replace(/\s+/g, '')).to.equal(
				`
				\`test-item\`.\`id\`=?
					AND \`test-person\`.\`foo\`=?
			`.replace(/\s+/g, '')
			);

			expect(res.params).to.deep.equal([1, 'bar']);
		});
	});
});
