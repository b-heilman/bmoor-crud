
const expect = require('chai').expect;

const sut = require('./normalized.js');

describe('src/schema/normalized', function(){
	describe('Normalized', function(){
		it('should work and encode propertly', function(){
			const normalized = new sut.Normalized({});

			normalized.ensureSeries('model-1')
				.ensureDatum(new sut.DatumRef('hello'))
				.setAction('create')
				.setContent({
					foo: 'bar'
				});

			normalized.ensureSeries('model-2')
				.ensureDatum(new sut.DatumRef()) 
				.setAction('update')
				.setContent({
					hello: 'world'
				});

			normalized.ensureSeries('model-1')
				.ensureDatum(new sut.DatumRef())
				.setAction('update-create')
				.setContent({
					eins: 'zwei'
				});

			expect(normalized.toJSON())
			.to.deep.equal({
				'model-1': [{
					$ref: 'hello',
					$type: 'create',
					foo: 'bar'
				}, {
					$ref: 'model-1:2',
					$type: 'update-create',
					eins: 'zwei'
				}],
				'model-2': [{
					$ref: 'model-2:1',
					$type: 'update',
					hello: 'world'
				}]
			});
		});

		describe('should allow sessions', function(){
			let session1 = null;
			let session2 = null;
			let session3 = null;
			let topSession = null;
			let normalized = null;

			beforeEach(function(){
				normalized = new sut.Normalized({});

				topSession = normalized.getSession();

				session1 = topSession.getChildSession();
				session1.defineDatum(
					'model-1', 
					new sut.DatumRef('hello'),
					'create',
					{
						foo: 'bar'
					}
				);

				session2 = topSession.getChildSession();
				session2.defineDatum(
					'model-2', 
					new sut.DatumRef(),
					'update'
				).setContent({
					hello: 'world'
				});

				session3 = session2.getChildSession();
				session3.defineDatum(
					'model-1', 
					new sut.DatumRef(),
					'update-create',
					{
						eins: 'zwei'
					}
				);
			});

			it('should properly populate the base normalization', function(){
				expect(normalized.toJSON())
				.to.deep.equal({
					'model-1': [{
						$ref: 'hello',
						$type: 'create',
						foo: 'bar'
					}, {
						$ref: 'model-1:2',
						$type: 'update-create',
						eins: 'zwei'
					}],
					'model-2': [{
						$ref: 'model-2:1',
						$type: 'update',
						hello: 'world'
					}]
				});
			});

			it ('should properly configure each session', function(){
				expect(session1.getSeries('model-1').map(datum => datum.toJSON()))
				.to.deep.equal([{
					$ref: 'hello',
					$type: 'create',
					foo: 'bar'
				}]);

				expect(session2.getSeries('model-1').map(datum => datum.toJSON()))
				.to.deep.equal([{
					$ref: 'model-1:2',
					$type: 'update-create',
					eins: 'zwei'
				}]);

				expect(session3.getSeries('model-1').map(datum => datum.toJSON()))
				.to.deep.equal([{
					$ref: 'model-1:2',
					$type: 'update-create',
					eins: 'zwei'
				}]);

				expect(topSession.getSeries('model-1').map(datum => datum.toJSON()))
				.to.deep.equal([{
					$ref: 'hello',
					$type: 'create',
					foo: 'bar'
				}, {
					$ref: 'model-1:2',
					$type: 'update-create',
					eins: 'zwei'
				}]);
			});
			
			it('should not mix up series', function(){
				expect(session2.getSeries('model-2').map(datum => datum.toJSON()))
				.to.deep.equal([{
					$ref: 'model-2:1',
					$type: 'update',
					hello: 'world'
				}]);

				expect(session3.getSeries('model-2').map(datum => datum.toJSON()))
				.to.deep.equal([{
					$ref: 'model-2:1',
					$type: 'update',
					hello: 'world'
				}]);

				expect(session3.getSeries('model-2').map(datum => datum.toJSON()))
				.to.deep.equal([{
					$ref: 'model-2:1',
					$type: 'update',
					hello: 'world'
				}]);
			});

			it('should have findLink work correctly', function(){
				expect(session1.findLink('model-1').toJSON())
				.to.deep.equal({
					$ref: 'hello',
					$type: 'create',
					foo: 'bar'
				});

				expect(session2.findLink('model-1').toJSON())
				.to.deep.equal({
					$ref: 'model-1:2',
					$type: 'update-create',
					eins: 'zwei'
				});

				expect(session3.findLink('model-1').toJSON())
				.to.deep.equal({
					$ref: 'model-1:2',
					$type: 'update-create',
					eins: 'zwei'
				});

				let failed = false;
				try {
					expect(topSession.findLink('model-1').toJSON())
					.to.deep.equal({
						$ref: 'model-2:1',
						$type: 'update',
						hello: 'world'
					});
				} catch (ex){
					expect(ex.message)
					.to.equal('found too many links');

					failed = true;
				}

				expect(failed)
				.to.equal(true);
			});
		});

		/***
		 * TODO: reimplemnt when ready
		it('should allow separate states', function(){
			const normalized = new sut.Normalized({});

			normalized.getDatum(
				'model-1', 
				new sut.DatumRef('hello'),
				'create'
			).setContent({
				foo: 'bar'
			});

			normalized.setVariable('eins', 1);

			let session1 = normalized.getSession();
			session1.getDatum(
				'model-2', 
				new sut.DatumRef(),
				'update'
			).setContent({
				hello: 'world'
			});

			session1.setVariable('zwei', 2);

			let session2 = normalized.getSession();
			session2.setDatum(
				'model-1', 
				new sut.DatumRef(),
				'update-create',
				{
					eins: 'zwei'
				}
			);

			session2.setVariable('zwei', 3);

			expect(normalized.toJSON())
			.to.deep.equal({
				'model-1': [{
					$ref: 'hello',
					$type: 'create',
					foo: 'bar'
				}, {
					$ref: 'model-1:2',
					$type: 'update-create',
					eins: 'zwei'
				}],
				'model-2': [{
					$ref: 'model-2:1',
					$type: 'update',
					hello: 'world'
				}]
			});

			expect(session1.getVariable('eins'))
			.to.equal(1);

			expect(session1.getVariable('zwei'))
			.to.equal(2);

			expect(session2.getVariable('eins'))
			.to.equal(1);

			expect(session2.getVariable('zwei'))
			.to.equal(3);
		});
		 ***/
		it('should allow schema importing', function(){
			const normalized = new sut.Normalized({});
			
			normalized.import({
				'model-1': [{
					$ref: 'hello',
					$type: 'create',
					foo: 'bar'
				}, {
					$ref: 'model-1:1',
					$type: 'update-create',
					eins: 'zwei'
				}],
				'model-2': [{
					$ref: 'model-2:0',
					$type: 'update',
					hello: 'world'
				}]
			});

			expect(normalized.toJSON())
			.to.deep.equal({
				'model-1': [{
					$ref: 'hello',
					$type: 'create',
					foo: 'bar'
				}, {
					$ref: 'model-1:1',
					$type: 'update-create',
					eins: 'zwei'
				}],
				'model-2': [{
					$ref: 'model-2:0',
					$type: 'update',
					hello: 'world'
				}]
			});
		});
	});
});
