
const {expect} = require('chai');

describe('src/model.js', function(){
	
	const {Model} = require('./model.js');

	it('should be defined', function(){
		expect(Model).to.exist;
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
				model.getIndex({
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
				model.getIndex({
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
				model.cleanDelta({
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
						updateType: 'major'
					},
					drei: {
						update: true,
						updateType: 'minor'
					},
					fier: {
						update: true,
						updateType: 'major'
					}
				}
			});

			expect(
				model.getChangeType({
					zwei: 2,
					drei: 3,
					fier: 4
				})
			).to.deep.equal({
				'major': 'fier',
				'minor': 'drei'
			});

			expect(
				model.getChangeType({
					zwei: 2,
					drei: 3
				})
			).to.deep.equal({
				'major': 'zwei',
				'minor': 'drei'
			});

			expect(
				model.getChangeType({
					zwei: 2
				})
			).to.deep.equal({
				'major': 'zwei'
			});

			expect(
				model.getChangeType({
					zwei: 2
				})
			).to.deep.equal({
				'major': 'zwei'
			});

			expect(
				model.getChangeType({
					foo: 'bar'
				})
			).to.be.null;
		});
	});

	// TODO : test types
});
