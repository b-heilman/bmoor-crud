
const expect = require('chai').expect;

const sut = require('./normalized.js');

describe('src/schema/normalized', function(){
	describe('Normalized', function(){
		it('should work and encode propertly', function(){
			const normalized = new sut.Normalized({});

			normalized.getDatum(
				'model-1', 
				new sut.DatumRef('hello'),
				'create'
			).setContent({
				foo: 'bar'
			});

			normalized.getDatum(
				'model-2', 
				new sut.DatumRef(),
				'update'
			).setContent({
				hello: 'world'
			});

			normalized.getDatum(
				'model-1', 
				new sut.DatumRef(),
				'update-create'
			).setContent({
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

		it('should allow sessions', function(){
			let session = null;

			const normalized = new sut.Normalized({});

			normalized.getDatum(
				'model-1', 
				new sut.DatumRef('hello'),
				'create'
			).setContent({
				foo: 'bar'
			});

			session = normalized.getSession();
			session.getDatum(
				'model-2', 
				new sut.DatumRef(),
				'update'
			).setContent({
				hello: 'world'
			});

			session = session.getSession();
			session.setDatum(
				'model-1', 
				new sut.DatumRef(),
				'update-create',
				{
					eins: 'zwei'
				}
			);

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

			expect(session.get('model-1').map(datum => datum.toJSON()))
			.to.deep.equal([{
				$ref: 'model-1:2',
				$type: 'update-create',
				eins: 'zwei'
			}]);
		});

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
