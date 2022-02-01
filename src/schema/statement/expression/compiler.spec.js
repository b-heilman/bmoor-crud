const {expect} = require('chai');

describe('schema/statement/compiler', function () {
	const sut = require('./compiler.js');

	it('should work with mixed company', function () {
		const exp = sut.buildExpression(`
			$foo.bar = "abc" & $foo.bar2 = 123 | $hell.world < 2.3
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
					series: 'hell',
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
});
