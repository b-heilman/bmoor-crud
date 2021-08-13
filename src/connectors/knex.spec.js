
const sinon = require('sinon');
const {expect} = require('chai');

const {Query, QueryParam, QueryField, QueryPosition, QuerySort} = require('../schema/query.js');

describe('src/interfaces/knex.js', function(){
	const sut = require('./knex.js');

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
