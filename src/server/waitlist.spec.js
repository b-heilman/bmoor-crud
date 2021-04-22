
const {expect} =  require('chai');

const sut = require('./waitlist.js');

describe('src/server/waitlist.js', function(){
	it('should work', async function(){
		const waitlist = new sut.Waitlist();

		const prom = waitlist.await('hello', 'world');

		const service = {
			structure: {
				name: 'hello',
				getKey: function(){
					return 123;
				}
			}
		};

		waitlist.resolve(service, 'world', 3);

		expect(await prom)
		.to.deep.equal({
			service,
			datum: 3,
			key: 123
		});
	});
});
