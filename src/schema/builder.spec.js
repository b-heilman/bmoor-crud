const expect = require('chai').expect;

describe('/src/schema/builder.js', function () {
	const sut = require('./builder.js');

	describe('Builder', function () {
		it('should properly stringify', function () {
			const builder = new sut.Builder();

			builder.set('foo.bar', new sut.Value('hello'));
			builder.set('eins.zwei', String('world'));
			builder.set('position', builder.getPlaceHolder());

			expect(JSON.stringify(builder)).to.equal(
				'{"foo":{"bar":"hello"},"eins":{"zwei":"world"},"position":"ref-0"}'
			);
		});
	});
});
