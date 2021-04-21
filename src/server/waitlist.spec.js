
const {expect} =  require('chai');

const sut = require('./waitlist.js');

describe('src/server/waitlist.js', function(){
	it('should work', async function(){
		const waitlist = new sut.Waitlist();

		const prom = waitlist.await('hello', 'world');

		waitlist.resolve('hello', 'world', 3);

		expect(await prom)
		.to.equal(3);
	});
});
