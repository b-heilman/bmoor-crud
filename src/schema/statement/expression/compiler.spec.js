const {expect} = require('chai');

describe('schema/statement/compiler', function () {
	const sut = require('./compiler.js');

	it('should work with booleans', function () {
		const exp = sut.buildExpression(`
			$eins-zwei.foo=true|$drei_fier.bar!=false
		`);

		expect(exp.toJSON()).to.deep.equal({
			join: 'or',
			expressables: [
				{
					series: 'eins-zwei',
					path: 'foo',
					operation: '=',
					value: true,
					settings: {}
				},
				{
					series: 'drei_fier',
					path: 'bar',
					operation: '!=',
					value: false,
					settings: {}
				}
			]
		});
	});

	it('should work with dashes', function () {
		const exp = sut.buildExpression(`
			$eins-zwei.foo=123&$drei_fier.bar<123.4
		`);

		expect(exp.toJSON()).to.deep.equal({
			join: 'and',
			expressables: [
				{
					series: 'eins-zwei',
					path: 'foo',
					operation: '=',
					value: 123,
					settings: {}
				},
				{
					series: 'drei_fier',
					path: 'bar',
					operation: '<',
					value: 123.4,
					settings: {}
				}
			]
		});
	});

	it('should work with mixed company', function () {
		const exp = sut.buildExpression(`
			$foo.bar = "abc" & $foo.bar2 = 123 | $hello.world < 2.3
		`);

		expect(exp.toJSON()).to.deep.equal({
			join: 'or',
			expressables: [
				{
					join: 'and',
					expressables: [
						{
							series: 'foo',
							path: 'bar',
							operation: '=',
							value: 'abc',
							settings: {}
						},
						{
							series: 'foo',
							path: 'bar2',
							operation: '=',
							value: 123,
							settings: {}
						}
					]
				},
				{
					series: 'hello',
					path: 'world',
					operation: '<',
					value: 2.3,
					settings: {}
				}
			]
		});
	});

	it('should work with really mixed company', function () {
		const exp = sut.buildExpression(`
			$foo.bar = "abc" & $foo.bar2 = 123 | $hell.world < 2.3 & $foo.dur = 'ok'
		`);

		expect(exp.toJSON()).to.deep.equal({
			join: 'or',
			expressables: [
				{
					join: 'and',
					expressables: [
						{
							series: 'foo',
							path: 'bar',
							operation: '=',
							value: 'abc',
							settings: {}
						},
						{
							series: 'foo',
							path: 'bar2',
							operation: '=',
							value: 123,
							settings: {}
						}
					]
				},
				{
					join: 'and',
					expressables: [
						{
							series: 'hell',
							path: 'world',
							operation: '<',
							value: 2.3,
							settings: {}
						},
						{
							series: 'foo',
							path: 'dur',
							operation: '=',
							value: 'ok',
							settings: {}
						}
					]
				}
			]
		});
	});

	it('should work with a grouping', function () {
		const exp = sut.buildExpression(`
			$foo.bar = "abc" & ($foo.bar2 = 123 | $hell.world < 2.3) & $foo.dur = 'ok'
		`);

		expect(exp.toJSON()).to.deep.equal({
			join: 'and',
			expressables: [
				{
					series: 'foo',
					path: 'bar',
					operation: '=',
					value: 'abc',
					settings: {}
				},
				{
					join: 'or',
					expressables: [
						{
							series: 'foo',
							path: 'bar2',
							operation: '=',
							value: 123,
							settings: {}
						},
						{
							series: 'hell',
							path: 'world',
							operation: '<',
							value: 2.3,
							settings: {}
						}
					]
				},
				{
					series: 'foo',
					path: 'dur',
					operation: '=',
					value: 'ok',
					settings: {}
				}
			]
		});
	});

	it('should work with an array', function () {
		//TODO: is someone puts a ] in the search, it goes boom...
		const exp = sut.buildExpression(
			'$foo.bar = ["abc", 123 ]' // abc[] goes boom
		);

		expect(exp.toJSON()).to.deep.equal({
			join: 'and',
			expressables: [
				{
					series: 'foo',
					path: 'bar',
					operation: '=',
					value: ['abc', 123],
					settings: {}
				}
			]
		});
	});
});
