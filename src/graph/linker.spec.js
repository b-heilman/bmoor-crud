
const expect = require('chai').expect;

const {Linker} = require('./linker.js');
const {Mapper} = require('./mapper.js');

describe('bmoor-data::model/Linker', function(){
	it('should work with a linear path', function(){
		const mapper = new Mapper();

		mapper.addLink('table-1', 'id', 'table-2', 'eins');
		mapper.addLink('table-2', 'id', 'table-3', 'zwei');
		mapper.addLink('table-3', 'id', 'table-4', 'drei');

		const linker = new Linker(mapper, 'table-1');

		expect(linker.search('table-4', 3).map(t => t.name))
		.to.deep.equal(['table-1', 'table-2', 'table-3', 'table-4']);
	});

	it('should not search further than it needs to', function(){
		const mapper = new Mapper();

		mapper.addLink('table-1', 'id', 'table-2', 'eins');
		mapper.addLink('table-2', 'id', 'table-3', 'zwei');
		mapper.addLink('table-3', 'id', 'table-4', 'drei');

		const linker = new Linker(mapper, 'table-1');

		expect(linker.search('table-3', 3).map(t => t.name))
		.to.deep.equal(['table-1', 'table-2', 'table-3']);
	});

	it('should respect the limit - 2', function(){
		const mapper = new Mapper();

		mapper.addLink('table-1', 'id', 'table-2', 'eins');
		mapper.addLink('table-2', 'id', 'table-3', 'zwei');
		mapper.addLink('table-3', 'id', 'table-4', 'drei');

		const linker = new Linker(mapper, 'table-1');

		expect(linker.search('table-4', 2))
		.to.equal(null);
	});

	it('should respect the limit - 1', function(){
		const mapper = new Mapper();

		mapper.addLink('table-1', 'id', 'table-2', 'eins');
		mapper.addLink('table-2', 'id', 'table-3', 'zwei');
		mapper.addLink('table-3', 'id', 'table-4', 'drei');

		const linker = new Linker(mapper, 'table-1');

		expect(linker.search('table-3', 1))
		.to.equal(null);
	});

	it('should work with the limit - 1', function(){
		const mapper = new Mapper();

		mapper.addLink('table-1', 'id', 'table-2', 'eins');
		mapper.addLink('table-2', 'id', 'table-3', 'zwei');
		mapper.addLink('table-3', 'id', 'table-4', 'drei');

		const linker = new Linker(mapper, 'table-1');

		expect(linker.search('table-2', 1).map(t => t.name))
		.to.deep.equal(['table-1', 'table-2']);
	});

	it('should pick the shortest route', function(){
		const mapper = new Mapper();

		mapper.addLink('table-1', 'id', 'table-2', 'eins');
		mapper.addLink('table-2', 'id', 'table-3', 'zwei');
		mapper.addLink('table-3', 'id', 'table-4', 'drei');
		mapper.addLink('table-1', 'id', 'table-4', 'eins');

		const linker = new Linker(mapper, 'table-1');

		expect(linker.search('table-4', 3).map(t => t.name))
		.to.deep.equal(['table-1', 'table-4']);
	});

	it('should pick the shortest route - again', function(){
		const mapper = new Mapper();

		mapper.addLink('table-1', 'id', 'table-2', 'eins');
		mapper.addLink('table-2', 'id', 'table-3', 'zwei');
		mapper.addLink('table-3', 'id', 'table-4', 'drei');
		mapper.addLink('table-2', 'id', 'table-4', 'zwei');

		const linker = new Linker(mapper, 'table-1');

		expect(linker.search('table-4', 3).map(t => t.name))
		.to.deep.equal(['table-1', 'table-2', 'table-4']);
	});
});
