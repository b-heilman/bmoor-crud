
const expect = require('chai').expect;

const {Mapper} = require('./mapper.js');
const {Network} = require('./network.js');

describe('src/graph/network', function(){
	describe('::search', function(){
		it('should work linearly', function(){
			const mapper = new Mapper();

			mapper.addLink('table-1', 'id', 'table-2', 'eins');
			mapper.addLink('table-2', 'id', 'table-3', 'zwei');
			mapper.addLink('table-3', 'id', 'table-4', 'drei');

			const network = new Network(mapper);

			expect(
				network.search(['table-1','table-2','table-4'], 3)
				.map(t => t.name)
			).to.deep.equal(['table-1', 'table-2', 'table-4', 'table-3']);
		});

		it('should pick the shortest route - 1', function(){
			const mapper = new Mapper();

			mapper.addLink('table-1', 'id', 'table-2', 'eins');
			mapper.addLink('table-2', 'id', 'table-3', 'zwei');
			mapper.addLink('table-3', 'id', 'table-4', 'drei');
			mapper.addLink('table-1', 'id', 'table-4', 'eins');

			const network = new Network(mapper);

			expect(
				network.search(['table-1','table-2','table-4'], 3)
				.map(t => t.name)
			).to.deep.equal(['table-1', 'table-2', 'table-4']);
		});

		it('should pick the shortest route - 2', function(){
			const mapper = new Mapper();

			mapper.addLink('table-1', 'id', 'table-2', 'eins');
			mapper.addLink('table-2', 'id', 'table-3', 'zwei');
			mapper.addLink('table-3', 'id', 'table-4', 'drei');
			mapper.addLink('table-1', 'id', 'table-4', 'eins');

			const network = new Network(mapper);

			expect(
				network.search(['table-1','table-3','table-4'], 3)
				.map(t => t.name)
			).to.deep.equal(['table-1', 'table-3', 'table-4']);
		});

		it('should pick the shortest route - 3', function(){
			const mapper = new Mapper();

			mapper.addLink('table-1', 'id', 'table-2', 'eins');
			mapper.addLink('table-2', 'id', 'table-3', 'zwei');
			mapper.addLink('table-3', 'id', 'table-4', 'drei');

			const network = new Network(mapper);

			let failed = false;

			try {
				network.search(['table-1','table-2','table-4'], 1);
			} catch(ex){
				failed = true;
			}

			expect(failed)
			.to.equal(true);
		});

		describe('with stub', function(){
			it('should pick the correct route', function(){
				const mapper = new Mapper();

				mapper.addLink('table-1', 'id', 'table-2', 'eins');
				mapper.addLink('table-2', 'id', 'table-3', 'zwei');
				mapper.addLink('table-3', 'id', 'table-4', 'drei');
				mapper.addLink('table-4', 'id', 'table-5', 'fier');
				mapper.addLink('table-1', 'id', 'table-5', 'eins');

				const network = new Network(mapper);

				expect(
					network.search(['table-1','table-3'], 3, {
						stub: ['table-2']
					}).map(t => t.name)
				).to.deep.equal(['table-1', 'table-3', 'table-5', 'table-4']);
			});
		});

		describe('with with join', function(){
			it('should link correctly in the short way', function(){
				const mapper = new Mapper();

				mapper.addLink('table-1', 'id', 'table-2', 'eins');
				mapper.addLink('table-2', 'id', 'table-3', 'zwei');
				mapper.addLink('table-3', 'id', 'table-4', 'drei');
				mapper.addLink('table-2', 'id', 'table-4', 'zwei');
				mapper.addLink('table-4', 'id', 'table-5', 'fier');
				mapper.addLink('table-1', 'id', 'table-5', 'eins');

				const network = new Network(mapper);

				expect(
					network.search(['table-1','table-3'], 3, {
						join: {
							'table-4': ['table-3'] // only table-4 can link to table-3
						}
					}).map(t => t.name)
				).to.deep.equal(['table-1', 'table-3', 'table-2', 'table-4']);
			});

			it('should link correctly in the long way', function(){
				const mapper = new Mapper();

				mapper.addLink('table-1', 'id', 'table-2', 'eins');
				mapper.addLink('table-2', 'id', 'table-3', 'zwei');
				mapper.addLink('table-3', 'id', 'table-4', 'drei');
				mapper.addLink('table-2', 'id', 'table-4', 'zwei');
				mapper.addLink('table-4', 'id', 'table-5', 'fier');
				mapper.addLink('table-1', 'id', 'table-5', 'eins');

				const network = new Network(mapper);

				expect(
					network.search(['table-1','table-3'], 3, {
						join: {
							'table-4': ['table-3'], // only table-4 can link to table-3
							'table-3': ['table-2']
						}
					}).map(t => t.name)
				).to.deep.equal(['table-1', 'table-3', 'table-5', 'table-4']);
			});
		});
	});

	describe('::requirements', function(){
		it('should order them correctly - order 1', function(){
			const mapper = new Mapper();

			mapper.addLink('table-1', 'id', 'table-2', 'table1Id');
			mapper.addLink('table-1', 'id', 'table-3', 'table1Id');
			mapper.addLink('table-3', 'id', 'table-4', 'table3Id');
			mapper.addLink('table-3', 'id', 'table-5', 'table3Id');
			mapper.addLink('table-5', 'id', 'table-6', 'table6Id');
			mapper.addLink('table-6', 'id', 'table-7', 'table7Id');

			const network = new Network(mapper);

			expect(
				network.requirements(['table-6','table-3','table-4'], 3)
				.map(t => t.name)
			).to.deep.equal(['table-6','table-4','table-5','table-3']);

			expect(
				network.requirements(['table-3','table-4','table-6'], 3)
				.map(t => t.name)
			).to.deep.equal(['table-4','table-6','table-5','table-3']);

			expect(
				network.requirements(['table-6','table-4','table-3'], 3)
				.map(t => t.name)
			).to.deep.equal(['table-6','table-4','table-5','table-3']);

			let master = ['table-1','table-7','table-2','table-3','table-4','table-6','table-5'];
			expect(
				network.requirements(master, 3)
				.map(t => t.name)
			).to.deep.equal(
				['table-7','table-2','table-4','table-6','table-5','table-3','table-1']
			);

			expect(
				network.requirements(master.reverse(), 3)
				.map(t => t.name)
			).to.deep.equal(
				['table-4','table-2','table-7','table-6','table-5','table-3','table-1']
			);
		});

		it('should order them correctly - order 2', function(){
			const mapper = new Mapper();

			mapper.addLink('table-1', 'table2Id', 'table-2', 'id');
			mapper.addLink('table-2', 'table3Id', 'table-3', 'id');
			mapper.addLink('table-2', 'table4Id', 'table-4', 'id');
			mapper.addLink('table-5', 'table3Id', 'table-3', 'id');
			mapper.addLink('table-6', 'table4Id', 'table-4', 'id');
			mapper.addLink('table-7', 'table5Id', 'table-5', 'id');
			mapper.addLink('table-7', 'table6Id', 'table-6', 'id');

			const network = new Network(mapper);

			let results = network.requirements([
				'table-7',
				'table-6',
				'table-5',
				'table-4',
				'table-3',
				'table-2',
				'table-1'
			], 1).map(t => t.name);

			expect(results)
			.to.deep.equal([
				'table-4',
				'table-3',
				'table-6',
				'table-5',
				'table-2',
				'table-7',
				'table-1'
			]);

			results = network.requirements([
				'table-1',
				'table-2',
				'table-3',
				'table-4',
				'table-5',
				'table-6',
				'table-7'
			], 1).map(t => t.name);

			expect(results)
			.to.deep.equal([
				'table-3',
				'table-4',
				'table-2',
				'table-5',
				'table-6',
				'table-1',
				'table-7'
			]);

			results = network.requirements([
				'table-1',
				'table-7',
				'table-3',
				'table-4',
				'table-2',
				'table-6',
				'table-5'
			], 1).map(t => t.name);

			expect(results)
			.to.deep.equal([
				'table-3',
				'table-4',
				'table-2',
				'table-6',
				'table-5',
				'table-1',
				'table-7'
			]);
		});

		it('should order them correctly - order 3', function(){
			const mapper = new Mapper();

			mapper.addLink('table-1', 'table2Id', 'table-2', 'id');
			mapper.addLink('table-1', 'table4Id', 'table-4', 'id');
			mapper.addLink('table-1', 'table6Id', 'table-6', 'id');
			mapper.addLink('table-2', 'table3Id', 'table-3', 'id');
			mapper.addLink('table-3', 'table6Id', 'table-6', 'id');
			mapper.addLink('table-4', 'table5Id', 'table-5', 'id');
			mapper.addLink('table-5', 'table2Id', 'table-2', 'id');
			mapper.addLink('table-5', 'table3Id', 'table-3', 'id');
			mapper.addLink('table-6', 'table7Id', 'table-7', 'id');

			const network = new Network(mapper);

			let results = network.requirements([
				'table-7',
				'table-6',
				'table-5',
				'table-4',
				'table-3',
				'table-2',
				'table-1'
			], 1).map(t => t.name);

			expect(results)
			.to.deep.equal([
				'table-7',
				'table-6',
				'table-3',
				'table-2',
				'table-5',
				'table-4',
				'table-1'
			]);
		});
	});

	describe('::anchored', function(){
		it('should order them correctly - order 1', function(){
			const mapper = new Mapper();

			mapper.addLink('table-1', 'id', 'table-2', 'table1Id');
			mapper.addLink('table-1', 'id', 'table-3', 'table1Id');
			mapper.addLink('table-3', 'id', 'table-4', 'table3Id');
			mapper.addLink('table-3', 'id', 'table-5', 'table3Id');
			mapper.addLink('table-5', 'id', 'table-6', 'table6Id');
			mapper.addLink('table-6', 'id', 'table-7', 'table7Id');

			const network = new Network(mapper);

			expect(
				network.anchored(['table-6','table-3','table-4'], 3)
				.map(t => t.name)
			).to.deep.equal(['table-3','table-4','table-5','table-6']);

			expect(
				network.anchored(['table-3','table-4','table-6'], 3)
				.map(t => t.name)
			).to.deep.equal(['table-3','table-4','table-5','table-6']);

			expect(
				network.anchored(['table-6','table-4','table-3'], 3)
				.map(t => t.name)
			).to.deep.equal(['table-3','table-4','table-5','table-6']);

			let master = ['table-1','table-7','table-2','table-3','table-4','table-6','table-5'];
			expect(
				network.anchored(master, 3)
				.map(t => t.name)
			).to.deep.equal(
				['table-3','table-1','table-4','table-5','table-2','table-6','table-7']
			);

			expect(
				network.anchored(master.reverse(), 3)
				.map(t => t.name)
			).to.deep.equal(
				['table-3','table-5','table-4','table-1','table-6','table-2','table-7']
			);
		});
	});
});
