
const {expect} = require('chai');

describe('src/model.js', function(){
	
	const {Model, config} = require('./model.js');

	it('should be defined', function(){
		expect(Model).to.exist;
	});

	describe('.actions', function(){
		describe('::create', function(){
			it('should work with a single field', function(){
				const model = new Model('test-1', {
					fields: {
						eins: {
							onCreate: function(tgt, src){
								tgt.foo = src.bar;
							}
						},
						zwei: {
						}
					}
				});

				expect(
					model.actions.create({}, {
						bar: 'eins',
						world: 'zwei'
					})
				).to.deep.equal({
					foo: 'eins'
				});
			});

			it('should work with multiple fields', function(){
				const model = new Model('test-1', {
					fields: {
						eins: {
							onCreate: function(tgt, src){
								tgt.foo = src.bar;
							}
						},
						zwei: {
							onCreate: function(tgt, src){
								tgt.hello = src.world;
							}
						}
					}
				});

				expect(
					model.actions.create({}, {
						bar: 'eins',
						world: 'zwei'
					})
				).to.deep.equal({
					foo: 'eins',
					hello: 'zwei'
				});
			});
		});

		describe('::update', function(){
			it('should work with a single field', function(){
				const model = new Model('test-1', {
					fields: {
						eins: {
							onUpdate: function(tgt, src){
								tgt.foo = src.bar;
							}
						},
						zwei: {
						}
					}
				});

				expect(
					model.actions.update({}, {
						bar: 'eins',
						world: 'zwei'
					})
				).to.deep.equal({
					foo: 'eins'
				});
			});

			it('should work with multiple fields', function(){
				const model = new Model('test-1', {
					fields: {
						eins: {
							onUpdate: function(tgt, src){
								tgt.foo = src.bar;
							}
						},
						zwei: {
							onUpdate: function(tgt, src){
								tgt.hello = src.world;
							}
						}
					}
				});

				expect(
					model.actions.update({}, {
						bar: 'eins',
						world: 'zwei'
					})
				).to.deep.equal({
					foo: 'eins',
					hello: 'zwei'
				});
			});
		});

		describe('::inflate', function(){
			it('should work with a single field', function(){
				const model = new Model('test-1', {
					fields: {
						eins: {
							onInflate: function(tgt, src){
								tgt.foo = src.bar;
							}
						},
						zwei: {
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
					bar: 'eins',
					world: 'zwei'
				});
			});

			it('should work with multiple fields', function(){
				const model = new Model('test-1', {
					fields: {
						eins: {
							onInflate: function(tgt, src){
								tgt.foo = src.bar;
							}
						},
						zwei: {
							onInflate: function(tgt, src){
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
					bar: 'eins',
					hello: 'zwei',
					world: 'zwei'
				});
			});

			it('should work with a mutation', function(){
				const model = new Model('test-1', {
					fields: {
						eins: {
							internal: 'one',
							onInflate: function(tgt, src, setter, getter){
								let value = getter(src);

								value += '-- 1';

								setter(tgt, value);
							}
						},
						zwei: {
						},
						drei: {
							internal: 'woot'
						}
					}
				});

				expect(
					model.actions.inflate({
						one: 'eins',
						world: 'foo',
						zwei: 'bar',
						woot: 'woot'
					})
				).to.deep.equal({
					eins: 'eins-- 1',
					zwei: 'bar',
					drei: 'woot'
				});
			});
		});

		describe('::deflate', function(){
			it('should work with a single field', function(){
				const model = new Model('test-1', {
					fields: {
						eins: {
							onDeflate: function(tgt, src){
								tgt.foo = src.bar;
							}
						},
						zwei: {
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
					bar: 'eins',
					world: 'zwei'
				});
			});

			it('should work with multiple fields', function(){
				const model = new Model('test-1', {
					fields: {
						eins: {
							onDeflate: function(tgt, src){
								tgt.foo = src.bar;
							}
						},
						zwei: {
							onDeflate: function(tgt, src){
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
					bar: 'eins',
					hello: 'zwei',
					world: 'zwei'
				});
			});

			it('should work with a mutation', function(){
				const model = new Model('test-1', {
					fields: {
						eins: {
							internal: 'one',
							onDeflate: function(tgt, src, setter, getter){
								let value = getter(src);

								value += '-- 1';

								setter(tgt, value);
							}
						},
						zwei: {
						},
						drei: {
							internal: 'woot'
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

		describe('via type', function(){ 
			describe('json', function(){
				it('should properly inflate', function(){
					const model = new Model('test-1', {
						fields: {
							eins: {
								type: 'json'
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

				it('should properly deflate', function(){
					const model = new Model('test-1', {
						fields: {
							eins: {
								type: 'json'
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
		});
	});

	describe('.properties', function(){
		it('should expand default properties correctly', function(){
			const model = new Model('test-1', {
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

			expect(model.properties.create)
			.to.deep.equal([
				'zwei',
				'fier',
				'funf'
			]);

			expect(model.properties.read)
			.to.deep.equal([
				'eins',
				'zwei',
				'drei',
				'fier',
				'funf'
			]);

			expect(model.properties.update)
			.to.deep.equal([
				'zwei'
			]);

			expect(model.properties.index)
			.to.deep.equal([
				'funf'
			]);

			expect(model.properties.key)
			.to.equal('eins');
		});
	});

	describe('::getKey', function(){
		it('pull in a singular value', function(){
			const model = new Model('test-1', {
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

		it('fail on multiple keys', function(){
			let failure = false;

			try {
				new Model('test-1', {
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
			} catch(ex){
				failure = true;
			}

			expect(failure).to.equal(true);
		});
	});

	describe('::getIndex', function(){
		it('pull in a singlar value', function(){
			const model = new Model('test-1', {
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

		it('pull in a multiple values', function(){
			const model = new Model('test-1', {
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

	describe('::cleanDelta', function(){
		it('pull in a singlar value', function(){
			const model = new Model('test-1', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						key: true
					},
					zwei: false,
					drei: {
						update: true
					}
				}
			});

			expect(
				model.clean('update', {
					eins: 1,
					drei: 3,
					junk: 'asdasd'
				})
			).to.deep.equal({drei: 3});
		});
	});

	describe('::getChanges', function(){
		it('pull in a singlar value', function(){
			const model = new Model('test-1', {
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
				model.getChanges({
					drei: 1,
					junk: 'foo-bar'
				}, {
					eins: 1,
					drei: 3,
					junk: 'asdasd'
				})
			).to.deep.equal({drei: 3});
		});
	});

	describe('::getChangeType', function(){
		it('pull in a singlar value', function(){
			const model = new Model('test-1', {
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
			).to.equal(null);

			expect(
				model.getChangeType({
					foo: 'bar'
				})
			).to.equal(null);
		});
	});

	// TODO : test types
});
