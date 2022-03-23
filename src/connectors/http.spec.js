const sinon = require('sinon');
const {expect} = require('chai');

describe('src/connectors/http.js', function () {
	const sut = require('./http.js');

	const {QueryStatement} = require('../schema/query/statement.js');
	const {
		ExecutableStatement,
		methods
	} = require('../schema/executable/statement.js');
	const {StatementVariable} = require('../schema/statement/variable.js');
	const {StatementField} = require('../schema/statement/field.js');
	const {QueryJoin} = require('../schema/query/join.js');

	describe('as an executable', function () {
		let operator = null;
		let context = null;

		beforeEach(function () {
			operator = sut.factory({
				crudBase: 'http://foo.bar.com/crud'
			});

			context = {
				fetch: sinon.stub()
			};
		});

		describe('create', function () {
			it('should work', async function () {
				const stmt = new ExecutableStatement('model-1')
					.setMethod(methods.create)
					.addFields('model-1', [
						new StatementField('id', 'key'),
						new StatementField('name', 'other'),
						new StatementField('title'),
						new StatementField('json')
					])
					.setPayload('model-1', {
						hello: 'world'
					});

				context.fetch.resolves({
					json: async () => [
						{
							foo: 'bar'
						}
					]
				});

				await operator.execute(stmt, context);

				const req = context.fetch.getCall(0);
				const url = req.args[0];
				const content = req.args[1];

				expect(url.href).to.equal('http://foo.bar.com/crud/model-1');

				expect(content.method).to.equal('post');

				expect(JSON.parse(content.body)).to.deep.equal({
					base: 'model-1',
					alias: 'model-1',
					remap: {
						key: 'id',
						other: 'name',
						title: 'title',
						json: 'json'
					},
					payload: {
						hello: 'world'
					}
				});
			});
		});

		describe('update', function () {
			it('should work', async function () {
				const stmt = new ExecutableStatement('model-1')
					.setMethod(methods.update)
					.addFields('model-1', [
						new StatementField('id'),
						new StatementField('name'),
						new StatementField('title'),
						new StatementField('json')
					])
					.setPayload('model-1', {
						hello: 'world'
					})
					.addParam(new StatementVariable('model-1', 'id', 123));

				context.fetch.resolves({
					json: async () => [
						{
							foo: 'bar'
						}
					]
				});

				await operator.execute(stmt, context);

				const req = context.fetch.getCall(0);
				const url = req.args[0];
				const content = req.args[1];

				expect(url.href).to.equal(
					'http://foo.bar.com/crud/model-1?query=%24model-1.id+%3D+123'
				);

				expect(content.method).to.equal('patch');

				expect(JSON.parse(content.body)).to.deep.equal({
					base: 'model-1',
					alias: 'model-1',
					remap: {
						id: 'id',
						name: 'name',
						title: 'title',
						json: 'json'
					},
					payload: {
						hello: 'world'
					}
				});
			});
		});

		describe('delete', function () {
			it('should work', async function () {
				const stmt = new ExecutableStatement('model-1')
					.setMethod(methods.delete)
					.addFields('model-1', [
						new StatementField('id'),
						new StatementField('name'),
						new StatementField('title'),
						new StatementField('json')
					])
					.addParam(new StatementVariable('model-1', 'id', 123));

				context.fetch.resolves({
					json: async () => [
						{
							foo: 'bar'
						}
					]
				});

				await operator.execute(stmt, context);

				const req = context.fetch.getCall(0);
				const url = req.args[0];
				const content = req.args[1];

				expect(url.href).to.equal(
					'http://foo.bar.com/crud/model-1?query=%24model-1.id+%3D+123'
				);

				expect(content.method).to.equal('delete');

				expect(JSON.parse(content.body)).to.deep.equal({
					base: 'model-1',
					alias: 'model-1',
					remap: {
						id: 'id',
						name: 'name',
						title: 'title',
						json: 'json'
					},
					payload: null
				});
			});
		});
	});

	describe('as a query', function () {
		let operator = null;
		let context = null;

		beforeEach(function () {
			operator = sut.factory({
				queryBase: 'http://foo.bar.com/query'
			});

			context = {
				fetch: sinon.stub()
			};
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

			context.fetch.resolves({
				json: async () => [
					{
						foo: 'bar'
					}
				]
			});

			await operator.execute(stmt, context);

			const req = context.fetch.getCall(0);
			const url = req.args[0];
			const content = req.args[1];

			expect(url.href).to.equal(
				'http://foo.bar.com/query?query=%24model-1.id+%3D+123'
			);

			expect(JSON.parse(content.body)).to.deep.equal({
				base: 'model-1',
				alias: 'model-1',
				joins: [],
				fields: {
					id: '$model-1.id',
					name: '$model-1.name',
					title: '$model-1.title',
					json: '$model-1.json'
				}
			});
		});

		it('should handle a null query', async function () {
			const stmt = new QueryStatement('model-1').addFields('model-1', [
				new StatementField('id'),
				new StatementField('name'),
				new StatementField('title'),
				new StatementField('json')
			]);

			context.fetch.resolves({
				json: async () => [
					{
						foo: 'bar'
					}
				]
			});

			await operator.execute(stmt, context);

			const req = context.fetch.getCall(0);
			const url = req.args[0];
			const content = req.args[1];

			expect(url.href).to.equal('http://foo.bar.com/query');
			expect(JSON.parse(content.body)).to.deep.equal({
				base: 'model-1',
				alias: 'model-1',
				joins: [],
				fields: {
					id: '$model-1.id',
					name: '$model-1.name',
					title: '$model-1.title',
					json: '$model-1.json'
				}
			});
		});

		it('should handle aliases', async function () {
			const stmt = new QueryStatement('model-1').addFields('model-1', [
				new StatementField('id', 'key'),
				new StatementField('name'),
				new StatementField('title'),
				new StatementField('json')
			]);

			context.fetch.resolves({
				json: async () => [
					{
						foo: 'bar'
					}
				]
			});

			await operator.execute(stmt, context);

			const req = context.fetch.getCall(0);
			const url = req.args[0];
			const content = req.args[1];

			expect(url.href).to.equal('http://foo.bar.com/query');
			expect(JSON.parse(content.body)).to.deep.equal({
				base: 'model-1',
				alias: 'model-1',
				joins: [],
				fields: {
					key: '$model-1.id',
					name: '$model-1.name',
					title: '$model-1.title',
					json: '$model-1.json'
				}
			});
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

			context.fetch.resolves({
				json: async () => [
					{
						foo: 'bar'
					}
				]
			});

			await operator.execute(stmt, context);

			const req = context.fetch.getCall(0);
			const url = req.args[0];
			const content = req.args[1];

			expect(url.href).to.equal(
				'http://foo.bar.com/query?query=%24test-item.id+%3D+1+%26+%24test-person.foo+%3D+%22bar%22'
			);
			expect(JSON.parse(content.body)).to.deep.equal({
				base: 'foo-bar',
				alias: 'test-item',
				joins: [
					'$test-item.id > .itemId$test-person:test-person',
					'$test-item.id > .itemId$test-category:test-category'
				],
				fields: {
					'test-item_0': '$test-item.name',
					'test-person_1': '$test-person.name',
					name: '$test-category.name',
					fooId: '$test-category.fooId'
				}
			});
		});
	});
});
