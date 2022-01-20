const expect = require('chai').expect;

const {Model} = require('../schema/model.js');
const {Mapper} = require('./mapper.js');

describe('src/mapper.js', function () {
	it('should properly instantiate', function () {
		const mapper = new Mapper();

		mapper.addLink('table-1', 'id', 'table-2', 'eins');
		mapper.addLink('table-2', 'id', 'table-3', 'zwei');
		mapper.addLink('table-3', 'id', 'table-4', 'drei');
		mapper.addLink('table-4', 'eins', 'table-1', 'id');

		const table1 = mapper.getLink('table-1');
		const table2 = mapper.getLink('table-2');
		const table3 = mapper.getLink('table-3');
		const table4 = mapper.getLink('table-4');

		expect(table1.reduceConnections()).to.deep.equal([
			{
				name: 'table-2',
				local: 'id',
				remote: 'eins',
				metadata: {
					direction: 'outgoing'
				}
			},
			{
				name: 'table-4',
				local: 'id',
				remote: 'eins',
				metadata: {
					direction: 'incoming'
				}
			}
		]);

		expect(table1.reduceConnectors()).to.deep.equal({
			'table-2': [
				{
					name: 'table-2',
					local: 'id',
					remote: 'eins',
					metadata: {
						direction: 'outgoing'
					}
				}
			],
			'table-4': [
				{
					name: 'table-4',
					local: 'id',
					remote: 'eins',
					metadata: {
						direction: 'incoming'
					}
				}
			]
		});

		expect(table2.reduceConnections()).to.deep.equal([
			{
				name: 'table-1',
				local: 'eins',
				remote: 'id',
				metadata: {
					direction: 'incoming'
				}
			},
			{
				name: 'table-3',
				local: 'id',
				remote: 'zwei',
				metadata: {
					direction: 'outgoing'
				}
			}
		]);

		expect(table2.reduceConnectors()).to.deep.equal({
			'table-1': [
				{
					name: 'table-1',
					local: 'eins',
					remote: 'id',
					metadata: {
						direction: 'incoming'
					}
				}
			],
			'table-3': [
				{
					name: 'table-3',
					local: 'id',
					remote: 'zwei',
					metadata: {
						direction: 'outgoing'
					}
				}
			]
		});

		expect(table3.reduceConnections()).to.deep.equal([
			{
				name: 'table-2',
				local: 'zwei',
				remote: 'id',
				metadata: {
					direction: 'incoming'
				}
			},
			{
				name: 'table-4',
				local: 'id',
				remote: 'drei',
				metadata: {
					direction: 'outgoing'
				}
			}
		]);

		expect(table3.reduceConnectors()).to.deep.equal({
			'table-2': [
				{
					name: 'table-2',
					local: 'zwei',
					remote: 'id',
					metadata: {
						direction: 'incoming'
					}
				}
			],
			'table-4': [
				{
					name: 'table-4',
					local: 'id',
					remote: 'drei',
					metadata: {
						direction: 'outgoing'
					}
				}
			]
		});

		expect(table4.reduceConnections()).to.deep.equal([
			{
				name: 'table-3',
				local: 'drei',
				remote: 'id',
				metadata: {
					direction: 'incoming'
				}
			},
			{
				name: 'table-1',
				local: 'eins',
				remote: 'id',
				metadata: {
					direction: 'outgoing'
				}
			}
		]);

		expect(table4.reduceConnectors()).to.deep.equal({
			'table-3': [
				{
					name: 'table-3',
					local: 'drei',
					remote: 'id',
					metadata: {
						direction: 'incoming'
					}
				}
			],
			'table-1': [
				{
					name: 'table-1',
					local: 'eins',
					remote: 'id',
					metadata: {
						direction: 'outgoing'
					}
				}
			]
		});
	});

	describe('::getRelationships', function () {
		let mapper = null;

		beforeEach(function () {
			mapper = new Mapper();
		});

		it('pull in a singlar value', async function () {
			const model1 = new Model('test-1');

			await model1.configure({
				fields: {
					eins: {
						update: false
					},
					zwei: {
						update: true,
						link: {
							name: 'test-2',
							field: 'id'
						}
					}
				}
			});

			const model2 = new Model('test-2');

			await model2.configure({
				fields: {
					id: {
						update: false
					}
				}
			});

			const model3 = new Model('test-3');

			await model3.configure({
				fields: {
					id: {
						update: false
					},
					zwei: {
						update: true,
						link: {
							name: 'test-2',
							field: 'id'
						}
					}
				}
			});

			mapper.addModel(model1);
			mapper.addModel(model2);
			mapper.addModel(model3);

			expect(mapper.getRelationships(model1.name)).to.deep.equal([
				{
					name: 'test-2',
					local: 'zwei',
					remote: 'id',
					metadata: {direction: 'outgoing'}
				}
			]);

			expect(mapper.getRelationships(model3.name)).to.deep.equal([
				{
					name: 'test-2',
					local: 'zwei',
					remote: 'id',
					metadata: {direction: 'outgoing'}
				}
			]);

			expect(mapper.getRelationships(model2.name)).to.deep.equal([
				{
					name: 'test-1',
					local: 'id',
					remote: 'zwei',
					metadata: {direction: 'incoming'}
				},
				{
					name: 'test-3',
					local: 'id',
					remote: 'zwei',
					metadata: {direction: 'incoming'}
				}
			]);
		});
	});

	describe('::getRelationship', function () {
		let mapper = null;

		beforeEach(function () {
			mapper = new Mapper();
		});

		it('pull in a singlar value', async function () {
			const model1 = new Model('test-1');

			await model1.configure({
				fields: {
					eins: {
						update: false
					},
					zwei: {
						update: true,
						link: {
							name: 'test-2',
							field: 'id'
						}
					},
					drei: {
						update: true,
						link: {
							name: 'test-3',
							field: 'id'
						}
					},
					fier: {
						update: true,
						link: {
							name: 'test-3',
							field: 'id'
						}
					},
					parentId: {
						create: true,
						link: {
							name: 'test-1',
							field: 'id'
						}
					}
				}
			});

			const model2 = new Model('test-2');
			await model2.configure({
				fields: {
					id: {
						update: false
					}
				}
			});

			const model3 = new Model('test-3');
			model3.configure({
				fields: {
					id: {
						update: false
					}
				}
			});

			mapper.addModel(model1);
			mapper.addModel(model2);
			mapper.addModel(model3);

			expect(mapper.getRelationship(model1.name, 'test-2')).to.deep.equal({
				name: 'test-2',
				local: 'zwei',
				remote: 'id',
				metadata: {direction: 'outgoing'}
			});

			expect(mapper.getRelationship(model1.name, 'test-3')).to.deep.equal({
				name: 'test-3',
				local: 'drei',
				remote: 'id',
				metadata: {direction: 'outgoing'}
			});

			expect(
				mapper.getRelationship(model1.name, 'test-3', 'drei')
			).to.deep.equal({
				name: 'test-3',
				local: 'drei',
				remote: 'id',
				metadata: {direction: 'outgoing'}
			});

			expect(
				mapper.getRelationship(model1.name, 'test-3', 'fier')
			).to.deep.equal({
				name: 'test-3',
				local: 'fier',
				remote: 'id',
				metadata: {direction: 'outgoing'}
			});

			expect(mapper.getRelationship(model1.name, 'test-4')).to.equal(null);
		});
	});

	describe('#getByDirection', function () {
		const mapper = new Mapper();

		// table-1 {id}
		mapper.addLink('table-2', 'einsId', 'table-1', 'id');
		mapper.addLink('table-4', 'einsId', 'table-1', 'id');
		mapper.addLink('table-3', 'zweiId', 'table-2', 'id');
		mapper.addLink('table-3', 'fierId', 'table-4', 'id');
		mapper.addLink('table-5', 'fierId', 'table-4', 'id');

		it('should let me get all incoming routes', function () {
			expect(
				mapper.getByDirection('table-1', 'incoming').map((t) => t.name)
			).to.deep.equal(['table-2', 'table-4']);

			expect(
				mapper.getByDirection('table-1', 'outgoing').map((t) => t.name)
			).to.deep.equal([]);

			expect(
				mapper.getByDirection('table-4', 'incoming').map((t) => t.name)
			).to.deep.equal(['table-3', 'table-5']);

			expect(
				mapper.getByDirection('table-4', 'outgoing').map((t) => t.name)
			).to.deep.equal(['table-1']);
		});
	});
});
