
const {expect} = require('chai');

const sut = require('./cache.js');

describe('src/server/cache.js', function(){
	it('should work', function(){
		const cache = new sut.Cache();

		cache.set('eins', 1, {foo:'bar'});

		expect(cache.has('eins', 1))
		.to.equal(true);

		expect(cache.has('zwei', 1))
		.to.equal(false);

		expect(cache.has('eins', 2))
		.to.equal(false);

		expect(cache.get('eins', 1))
		.to.deep.equal({foo: 'bar'});

		expect(cache.get('zwei', 1))
		.to.deep.equal(undefined);

		expect(cache.get('eins', 2))
		.to.deep.equal(undefined);
	});
});
