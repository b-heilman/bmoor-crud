const sinon = require('sinon');
const {expect} = require('chai');

const {Statement} = require('./statement.js');

describe('src/schema/structure.js', function () {
	const sut = require('./structure.js');
	const now = Date.now();

	let base = null;
	let ctx = null;
	let clock = null;
	let permissions = null;

	beforeEach(function () {
		ctx = {};
		permissions = {};

		base = new Statement('base-series', 'base-model');

		clock = sinon.useFakeTimers(now);

		ctx.hasPermission = function (permission) {
			return !!permissions[permission];
		};
	});

	afterEach(function () {
		clock.restore();
	});

	describe('::extendStatement', function () {
		it('should work with base settings', async function () {
			const structure = new sut.Structure('base-struct');

			structure.setSource({isFlat: false});
			await structure.configure({});

			await Promise.all([
				structure.addField('eins', {
					series: 'series-1',
					storagePath: 'path1',
					reference: 'path1'
				}),
				structure.addField('zwei', {
					series: 'series-2',
					storagePath: 'path2',
					reference: 'path2',
					read: true
				}),
				structure.addField('foo.bar', {
					series: 'series-1',
					storagePath: 'path3',
					reference: 'path3',
					read: true
				}),
				structure.addField('hello.world', {
					series: 'series-2',
					storagePath: 'path4',
					reference: 'path4',
					read: true
				})
			]);

			await structure.build();

			await structure.extendStatement(base, {}, ctx);

			expect(base.toJSON()).to.deep.equal({
				models: [
					{
						series: 'base-series',
						schema: undefined
					},
					{
						series: 'series-2',
						schema: 'series-2'
					},
					{
						series: 'series-1',
						schema: 'series-1'
					}
				],
				fields: [
					{
						series: 'series-2',
						path: 'path2',
						as: 'path2'
					},
					{
						series: 'series-2',
						path: 'path4',
						as: 'path4'
					},
					{
						series: 'series-1',
						path: 'path3',
						as: 'path3'
					}
				],
				filters: {
					join: 'and',
					expressables: []
				},
				params: {
					join: 'and',
					expressables: []
				}
			});
		});
	});

	describe('::actions', function () {
		let structure = null;

		beforeEach(async function () {
			structure = new sut.Structure('base-struct');

			structure.configure({});
			structure.setSource({isFlat: false});

			await Promise.all([
				structure.addField('eins', {
					storagePath: 'path1',
					reference: 'ref1',
					usage: 'json',
					read: true,
					create: true
				}),
				structure.addField('zwei', {
					storagePath: 'path2',
					reference: 'ref2',
					usage: 'monitor',
					cfg: {
						target: 'eins'
					},
					read: true,
					update: true
				}),
				structure.addField('foo.bar', {
					storagePath: 'attr.path3',
					reference: 'attr.ref3'
				}),
				structure.addField('hello.world', {
					storagePath: 'attr.path4',
					reference: 'attr.ref4',
					read: true,
					create: true,
					update: true
				})
			]);

			structure.build();
		});

		describe('::inflate', function () {
			it('should properly inflate', async function () {
				expect(
					structure.actions.inflate({
						eins: '{"foo":"bar"}'
					})
				).to.deep.equal({
					eins: {
						foo: 'bar'
					}
				});
			});

			it('should worked when remapped', async function () {
				expect(
					structure.actions
						.remap({
							hello: {
								world: 'eins'
							}
						})
						.inflate({
							hello: {
								world: '{"foo":"bar"}'
							}
						})
				).to.deep.equal({
					hello: {
						world: {
							foo: 'bar'
						}
					}
				});
			});
		});

		describe('::deflate', function () {
			it('should properly deflate', async function () {
				expect(
					structure.actions.deflate({
						eins: {
							foo: 'bar'
						}
					})
				).to.deep.equal({
					eins: '{"foo":"bar"}'
				});
			});
		});

		describe('::onCreate', function () {
			it('should properly deflate', async function () {
				expect(
					structure.actions.create({
						eins: {
							foo: 'bar'
						}
					})
				).to.deep.equal({
					eins: {
						foo: 'bar'
					},
					zwei: now
				});
			});
		});

		describe('::onUpdate', function () {
			it('should properly deflate', async function () {
				expect(
					structure.actions.update({
						eins: {
							foo: 'bar'
						}
					})
				).to.deep.equal({
					eins: {
						foo: 'bar'
					},
					zwei: now
				});
			});
		});

		describe('::convertFromStorage', function () {
			it('should work', async function () {
				expect(
					structure.actions.convertFromStorage({
						junk: true,
						ref1: 'eins',
						ref2: 2,
						attr: {
							ref3: undefined,
							ref4: null
						}
					})
				).to.deep.equal({
					eins: 'eins',
					zwei: 2,
					hello: {
						world: null
					}
				});
			});

			it('should worked when remapped', async function () {
				expect(
					structure.actions
						.remap({
							prop: {
								remapped: 'eins',
								other: 'hello.world'
							}
						})
						.convertFromStorage({
							junk: true,
							ref1: 'eins',
							ref2: 2,
							attr: {
								ref3: undefined,
								ref4: null
							}
						})
				).to.deep.equal({
					prop: {
						remapped: 'eins',
						other: null
					}
				});
			});
		});

		describe('::convertFromCreate', function () {
			it('should work', async function () {
				expect(
					structure.actions.convertFromCreate({
						junk: true,
						eins: 'eins',
						zwei: 2,
						foo: {
							bar: undefined
						},
						hello: {
							world: null
						}
					})
				).to.deep.equal({
					path1: 'eins',
					attr: {
						path4: null
					}
				});
			});
		});

		describe('::convertFromUpdate', function () {
			it('should work', async function () {
				expect(
					structure.actions.convertFromUpdate({
						junk: true,
						eins: 'eins',
						zwei: 2,
						foo: {
							bar: undefined
						},
						hello: {
							world: null
						}
					})
				).to.deep.equal({
					path2: 2,
					attr: {
						path4: null
					}
				});
			});
		});
	});
});
