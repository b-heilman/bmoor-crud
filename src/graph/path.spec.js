
const expect = require('chai').expect;

const sut = require('./Path.js');

describe('src/graph/path.js', function(){
	describe('Path', function(){
		describe('.access', function(){
			it('should properly parse a simple access', function(){
				expect((new sut.Path('$foo-bar.field')).access)
				.to.deep.equal([{
					loader: 'access',
					model: 'foo-bar',
					root: 'foo-bar',
					field: 'field',
					target: null
				}]);
			});

			it('should properly parse a simple include', function(){
				expect((new sut.Path('#foo-bar.field')).access)
				.to.deep.equal([{
					loader: 'include',
					model: 'foo-bar',
					root: 'foo-bar',
					field: 'field',
					target: null
				}]);
			});

			it('should properly parse a target with simple access', function(){
				expect((new sut.Path('@dupe$foo-bar.field')).access)
				.to.deep.equal([{
					loader: 'access',
					model: 'foo-bar',
					root: 'foo-bar',
					field: 'field',
					target: 'dupe'
				}]);
			});

			it('should properly parse a target with simple include', function(){
				expect((new sut.Path('@hello-world#foo-bar.field')).access)
				.to.deep.equal([{
					loader: 'include',
					model: 'foo-bar',
					root: 'foo-bar',
					field: 'field',
					target: 'hello-world'
				}]);
			});

			it('should properly parse a multipart string', function(){
				expect((new sut.Path('$foo-bar.field > $hello-world.id')).access)
				.to.deep.equal([{
					loader: 'access',
					model: 'foo-bar',
					root: 'foo-bar',
					field: 'field',
					target: null
				}, {
					loader: 'access',
					model: 'hello-world',
					root: 'foo-bar.field:hello-world',
					field: 'id',
					target: null
				}]);
			});
		});

		describe('.path', function(){
			it('should copy the path if it is a striing', function(){
				expect((new sut.Path('$foo-bar.field > $hello-world.id')).path)
				.to.deep.equal('$foo-bar.field > $hello-world.id');
			});

			it('should properly join into a multipart string', function(){
				const accessors = [{
					loader: 'access',
					model: 'foo-bar',
					root: 'foo-bar',
					field: 'field',
					target: null
				}, {
					loader: 'access',
					model: 'hello-world',
					root: 'foo-bar.field:hello-world',
					field: 'id',
					target: null
				}];

				expect(new sut.Path(accessors).path)
				.to.equal('$foo-bar.field>$hello-world.id');
			});
		});
	});
});
