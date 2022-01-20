const sinon = require('sinon');
const {expect} = require('chai');

const {Nexus, config: nexusConfig} = require('../env/nexus.js');
const {config} = require('./structure.js');

describe('src/schema/model.js', function () {
	const {Model} = require('./model.js');

	let now = Date.now();
	let nexus = null;
	let clock = null;
	let connector = null;

	beforeEach(async function () {
		nexusConfig.set('timeout', 500);

		clock = sinon.useFakeTimers(now);

		nexus = new Nexus();

		connector = {
			// this doesn't matter here, right?
		};

		await nexus.setConnector('test', async () => connector);

		await nexus.configureSource('test-1', {
			connector: 'test'
		});
	});

	afterEach(function () {
		clock.restore();
	});

	it('should be defined', function () {
		expect(Model).to.exist;
	});

	describe('.actions', function () {
		describe('::create', function () {
			it('should work with a single field', async function () {
				const model = new Model('test-1', nexus);

				await model.configure({
					fields: {
						eins: {
							onCreate: function (tgt, src) {
								tgt.foo = src.bar;
							}
						},
						zwei: {}
					}
				});

				expect(
					model.actions.create(
						{},
						{
							bar: 'eins',
							world: 'zwei'
						}
					)
				).to.deep.equal({
					foo: 'eins'
				});
			});

			it('should work with multiple fields', async function () {
				const model = new Model('test-1');

				await model.configure({
					fields: {
						eins: {
							onCreate: function (tgt, src) {
								tgt.foo = src.bar;
							}
						},
						zwei: {
							onCreate: function (tgt, src) {
								tgt.hello = src.world;
							}
						}
					}
				});

				expect(
					model.actions.create(
						{},
						{
							bar: 'eins',
							world: 'zwei'
						}
					)
				).to.deep.equal({
					foo: 'eins',
					hello: 'zwei'
				});
			});
		});

		describe('::update', function () {
			it('should work with a single field', async function () {
				const model = new Model('test-1');

				await model.configure({
					fields: {
						eins: {
							onUpdate: function (tgt, src) {
								tgt.foo = src.bar;
							}
						},
						zwei: {}
					}
				});

				expect(
					model.actions.update(
						{},
						{
							bar: 'eins',
							world: 'zwei'
						}
					)
				).to.deep.equal({
					foo: 'eins'
				});
			});

			it('should work with multiple fields', async function () {
				const model = new Model('test-1');

				await model.configure({
					fields: {
						eins: {
							onUpdate: function (tgt, src) {
								tgt.foo = src.bar;
							}
						},
						zwei: {
							onUpdate: function (tgt, src) {
								tgt.hello = src.world;
							}
						}
					}
				});

				expect(
					model.actions.update(
						{},
						{
							bar: 'eins',
							world: 'zwei'
						}
					)
				).to.deep.equal({
					foo: 'eins',
					hello: 'zwei'
				});
			});
		});

		describe('::inflate', function () {
			it('should work with a single field', async function () {
				const model = new Model('test-1');

				await model.configure({
					fields: {
						eins: {
							onInflate: function (tgt, src) {
								tgt.foo = src.bar;
							}
						},
						zwei: {}
					}
				});

				expect(
					model.actions.inflate({
						bar: 'eins',
						world: 'zwei'
					})
				).to.deep.equal({
					foo: 'eins'
				});
			});

			it('should work with multiple fields', async function () {
				const model = new Model('test-1');

				await model.configure({
					fields: {
						eins: {
							onInflate: function (tgt, src) {
								tgt.foo = src.bar;
							}
						},
						zwei: {
							onInflate: function (tgt, src) {
								tgt.hello = src.world;
							}
						}
					}
				});

				expect(
					model.actions.inflate({
						bar: 'eins',
						world: 'zwei'
					})
				).to.deep.equal({
					foo: 'eins',
					hello: 'zwei'
				});
			});

			it('should work with a mutation', async function () {
				const model = new Model('test-1');

				await model.configure({
					fields: {
						eins: {
							reference: 'one',
							onInflate: function (tgt, src, setter, getter) {
								let value = getter(src);

								value += '-- 1';

								setter(tgt, value);
							}
						},
						zwei: {},
						drei: {
							reference: 'woot'
						}
					}
				});

				const res = model.actions.inflate({
					one: 'eins',
					world: 'foo',
					zwei: 'bar',
					woot: 'woot'
				});

				expect(res).to.deep.equal({
					eins: 'eins-- 1',
					zwei: 'bar',
					drei: 'woot'
				});
			});
		});

		describe('::deflate', function () {
			it('should work with a single field', async function () {
				const model = new Model('test-1');

				await model.configure({
					fields: {
						eins: {
							onDeflate: function (tgt, src) {
								tgt.foo = src.bar;
							}
						},
						zwei: {}
					}
				});

				expect(
					model.actions.deflate({
						bar: 'eins',
						world: 'zwei'
					})
				).to.deep.equal({
					foo: 'eins'
				});
			});

			it('should work with multiple fields', async function () {
				const model = new Model('test-1');

				await model.configure({
					fields: {
						eins: {
							onDeflate: function (tgt, src) {
								tgt.foo = src.bar;
							}
						},
						zwei: {
							onDeflate: function (tgt, src) {
								tgt.hello = src.world;
							}
						}
					}
				});

				expect(
					model.actions.deflate({
						bar: 'eins',
						world: 'zwei'
					})
				).to.deep.equal({
					foo: 'eins',
					hello: 'zwei'
				});
			});

			it('should work with a mutation', async function () {
				const model = new Model('test-1');

				await model.configure({
					fields: {
						eins: {
							storagePath: 'one',
							onDeflate: function (tgt, src, setter, getter) {
								let value = getter(src);

								value += '-- 1';

								setter(tgt, value);
							}
						},
						zwei: {},
						drei: {
							storagePath: 'woot'
						}
					}
				});

				expect(
					model.actions.deflate({
						eins: 'eins',
						world: 'foo',
						zwei: 'bar',
						drei: 'woot'
					})
				).to.deep.equal({
					one: 'eins-- 1',
					zwei: 'bar',
					woot: 'woot'
				});
			});
		});

		describe('via type', function () {
			describe('json', function () {
				it('should properly inflate', async function () {
					const model = new Model('test-1');

					await model.configure({
						fields: {
							eins: {
								usage: 'json'
							}
						}
					});

					expect(
						model.actions.inflate({
							eins: '{"foo":"bar"}'
						})
					).to.deep.equal({
						eins: {
							foo: 'bar'
						}
					});
				});

				it('should properly deflate', async function () {
					const model = new Model('test-1');

					await model.configure({
						fields: {
							eins: {
								usage: 'json'
							}
						}
					});

					expect(
						model.actions.deflate({
							eins: {
								foo: 'bar'
							}
						})
					).to.deep.equal({
						eins: '{"foo":"bar"}'
					});
				});
			});

			describe('monitor', function () {
				it('should properly on create', async function () {
					const model = new Model('test-1');

					await model.configure({
						fields: {
							eins: {
								create: true
							},
							zwei: {
								usage: 'monitor',
								cfg: {
									target: 'eins'
								}
							}
						}
					});

					expect(
						model.actions.create(
							{junk: 'ok'},
							{
								eins: 1
							}
						)
					).to.deep.equal({
						junk: 'ok',
						zwei: now
					});
				});

				it('should properly on update', async function () {
					const model = new Model('test-1');

					await model.configure({
						fields: {
							eins: {
								create: true
							},
							zwei: {
								usage: 'monitor',
								cfg: {
									target: 'eins'
								}
							}
						}
					});

					expect(
						model.actions.update(
							{junk: 'ok'},
							{
								eins: 1
							}
						)
					).to.deep.equal({
						junk: 'ok',
						zwei: now
					});
				});

				it('should properly on update with 0', async function () {
					const model = new Model('test-1');

					await model.configure({
						fields: {
							eins: {
								create: true
							},
							zwei: {
								usage: 'monitor',
								cfg: {
									target: 'eins'
								}
							}
						}
					});

					expect(
						model.actions.update(
							{junk: 'ok'},
							{
								eins: 0
							}
						)
					).to.deep.equal({
						junk: 'ok',
						zwei: now
					});
				});

				it('should properly on update with null', async function () {
					const model = new Model('test-1');

					await model.configure({
						fields: {
							eins: {
								create: true
							},
							zwei: {
								usage: 'monitor',
								cfg: {
									target: 'eins'
								}
							}
						}
					});

					expect(
						model.actions.update(
							{junk: 'ok'},
							{
								eins: null
							}
						)
					).to.deep.equal({
						junk: 'ok',
						zwei: now
					});
				});

				it('should properly on update with undefined', async function () {
					const model = new Model('test-1');

					await model.configure({
						fields: {
							eins: {
								create: true
							},
							zwei: {
								usage: 'monitor',
								cfg: {
									target: 'eins'
								}
							}
						}
					});

					expect(
						model.actions.update(
							{junk: 'ok'},
							{
								eins: undefined
							}
						)
					).to.deep.equal({
						junk: 'ok'
					});
				});
			});
		});
	});

	describe('.settings', function () {
		it('should expand default settings correctly', async function () {
			const model = new Model('test-1');

			await model.configure({
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						key: true
					},
					zwei: true,
					drei: false,
					fier: {
						create: true,
						read: true,
						update: false
					},
					funf: {
						create: true,
						read: true,
						update: false,
						index: true
					}
				}
			});

			expect(model.settings.create).to.deep.equal(['zwei', 'fier', 'funf']);

			expect(model.settings.read).to.deep.equal([
				'eins',
				'zwei',
				'drei',
				'fier',
				'funf'
			]);

			expect(model.settings.update).to.deep.equal(['zwei']);

			expect(model.settings.index).to.deep.equal(['funf']);

			expect(model.settings.key).to.equal('eins');
		});
	});

	describe('::getKey', function () {
		it('pull in a singular value', async function () {
			const model = new Model('test-1');

			await model.configure({
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						key: true
					},
					zwei: true,
					drei: false
				}
			});

			expect(
				model.getKey({
					eins: 1,
					zwei: 2
				})
			).to.deep.equal(1);
		});

		it('fail on multiple keys', async function () {
			let failure = false;

			try {
				const model = new Model('test-1');

				await model.configure({
					fields: {
						eins: {
							key: true
						},
						zwei: {
							key: true
						},
						drei: false
					}
				});
			} catch (ex) {
				failure = true;
			}

			expect(failure).to.equal(true);
		});
	});

	describe('::getIndex', function () {
		it('pull in a singlar value', async function () {
			const model = new Model('test-1');

			await model.configure({
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						key: true
					},
					zwei: false,
					drei: {
						index: true
					}
				}
			});

			expect(
				model.clean('index', {
					drei: 3
				})
			).to.deep.equal({drei: 3});
		});

		it('pull in a multiple values', async function () {
			const model = new Model('test-1');

			await model.configure({
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						key: true
					},
					zwei: {
						index: true
					},
					drei: {
						index: true
					}
				}
			});

			expect(
				model.clean('index', {
					zwei: 2,
					drei: 3
				})
			).to.deep.equal({zwei: 2, drei: 3});
		});
	});

	describe('::getChanges', function () {
		it('pull in a singlar value', async function () {
			const model = new Model('test-1');

			await model.configure({
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						key: true
					},
					zwei: {
						update: false
					},
					drei: {
						update: true
					}
				}
			});

			expect(
				model.getChanges(
					{
						drei: 1,
						junk: 'foo-bar'
					},
					{
						eins: 1,
						drei: 3,
						junk: 'asdasd'
					}
				)
			).to.deep.equal({drei: 3});
		});
	});

	describe('::getChangeType', function () {
		it('pull in a singlar value', async function () {
			const model = new Model('test-1');

			await model.configure({
				fields: {
					eins: {
						update: false
					},
					zwei: {
						update: true,
						updateType: config.get('changeTypes.major')
					},
					drei: {
						update: true,
						updateType: config.get('changeTypes.minor')
					},
					fier: {
						update: true,
						updateType: config.get('changeTypes.major')
					}
				}
			});

			expect(
				model.getChangeType({
					zwei: 2,
					drei: 3
				})
			).to.equal(config.get('changeTypes.major'));

			expect(
				model.getChangeType({
					eins: 1,
					drei: 3
				})
			).to.equal(config.get('changeTypes.minor'));

			expect(
				model.getChangeType({
					zwei: 2
				})
			).to.equal(config.get('changeTypes.major'));

			expect(
				model.getChangeType({
					eins: 1
				})
			).to.equal(config.get('changeTypes.none'));

			expect(
				model.getChangeType({
					foo: 'bar'
				})
			).to.equal(config.get('changeTypes.none'));
		});
	});

	describe('::validate', function () {
		let model = true;

		const createMode = config.get('writeModes.create');
		const updateMode = config.get('writeModes.update');

		beforeEach(async function () {
			model = new Model('test-1');

			await model.configure({
				fields: {
					eins: {
						update: false
					},
					zwei: {
						update: true,
						validation: {
							required: false
						}
					},
					drei: {
						update: true,
						validation: {
							required: true
						}
					},
					fier: {
						update: true,
						validation: {
							required: true
						}
					}
				}
			});
		});

		it('should work on create', async function () {
			expect(
				model.validate({eins: 1, drei: 3, fier: 4}, createMode)
			).to.deep.equal([]);

			expect(model.validate({eins: 1, fier: 4}, createMode)).to.deep.equal([
				{path: 'drei', message: 'can not be empty'}
			]);

			expect(model.validate({eins: 1}, createMode)).to.deep.equal([
				{path: 'drei', message: 'can not be empty'},
				{path: 'fier', message: 'can not be empty'}
			]);

			expect(model.validate({eins: 1, drei: null}, createMode)).to.deep.equal([
				{path: 'drei', message: 'can not be empty'},
				{path: 'fier', message: 'can not be empty'}
			]);
		});

		it('should work on update', async function () {
			expect(
				model.validate({eins: 1, drei: 3, fier: 4}, updateMode)
			).to.deep.equal([]);

			expect(model.validate({eins: 1, fier: 4}, updateMode)).to.deep.equal([]);

			expect(model.validate({eins: 1}, updateMode)).to.deep.equal([]);

			expect(model.validate({eins: 1, drei: null}, updateMode)).to.deep.equal([
				{path: 'drei', message: 'can not be empty'}
			]);
		});
	});

	// TODO : test types
});
