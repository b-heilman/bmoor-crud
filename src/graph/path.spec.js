const expect = require('chai').expect;

const sut = require('./path.js');

describe('src/graph/path.js', function () {
	describe('Path', function () {
		describe('.access', function () {
			it('should properly parse a simple access', function () {
				expect(new sut.Path('$foo-bar.field').access).to.deep.equal([
					{
						loader: 'access',
						series: 'foo-bar',
						model: 'foo-bar',
						field: 'field',
						target: null,
						optional: false
					}
				]);
			});

			it('should properly parse an access with alias', function () {
				expect(new sut.Path('$hello:foo-bar.field').access).to.deep.equal([
					{
						loader: 'access',
						series: 'hello',
						model: 'foo-bar',
						field: 'field',
						target: null,
						optional: false
					}
				]);
			});

			it('should properly parse a simple include', function () {
				expect(new sut.Path('#foo-bar').access).to.deep.equal([
					{
						loader: 'include',
						series: 'foo-bar',
						model: 'foo-bar',
						field: null,
						target: null,
						optional: false
					}
				]);
			});

			it('should properly parse a simple include with alias', function () {
				expect(new sut.Path('#hello:foo-bar').access).to.deep.equal([
					{
						loader: 'include',
						series: 'hello',
						model: 'foo-bar',
						field: null,
						target: null,
						optional: false
					}
				]);
			});

			it('should properly parse a target with simple access', function () {
				expect(new sut.Path('.dupe$foo-bar.field').access).to.deep.equal([
					{
						loader: 'access',
						series: 'foo-bar',
						model: 'foo-bar',
						field: 'field',
						target: 'dupe',
						optional: false
					}
				]);
			});

			it('should properly parse an optional access', function () {
				expect(new sut.Path('> ?$foo-bar.field').access).to.deep.equal([
					{
						loader: 'access',
						series: 'foo-bar',
						model: 'foo-bar',
						field: 'field',
						target: null,
						optional: true
					}
				]);
			});

			it('should properly parse an optional access, with target', function () {
				expect(new sut.Path('>?.dupe$foo-bar.field').access).to.deep.equal([
					{
						loader: 'access',
						series: 'foo-bar',
						model: 'foo-bar',
						field: 'field',
						target: 'dupe',
						optional: true
					}
				]);
			});

			it('should properly parse a target with simple include', function () {
				expect(new sut.Path('.hello-world#foo-bar').access).to.deep.equal([
					{
						loader: 'include',
						series: 'foo-bar',
						model: 'foo-bar',
						field: null,
						target: 'hello-world',
						optional: false
					}
				]);
			});

			it('should properly parse a target with include and alias', function () {
				expect(new sut.Path('.hello-world#hello:foo-bar').access).to.deep.equal(
					[
						{
							loader: 'include',
							series: 'hello',
							model: 'foo-bar',
							field: null,
							target: 'hello-world',
							optional: false
						}
					]
				);
			});

			it('should properly parse a multipart string', function () {
				expect(
					new sut.Path('$foo-bar.field>$woot:hello-world.id').access
				).to.deep.equal([
					{
						loader: 'access',
						series: 'foo-bar',
						model: 'foo-bar',
						field: 'field',
						target: null,
						optional: false
					},
					{
						loader: 'access',
						series: 'woot',
						model: 'hello-world',
						field: 'id',
						target: null,
						optional: false
					}
				]);
			});

			it('should properly parse a multipart string with optional', function () {
				expect(
					new sut.Path('$foo-bar.field>?$hello-world.id').access
				).to.deep.equal([
					{
						loader: 'access',
						model: 'foo-bar',
						series: 'foo-bar',
						field: 'field',
						target: null,
						optional: false
					},
					{
						loader: 'access',
						model: 'hello-world',
						series: 'hello-world',
						field: 'id',
						target: null,
						optional: true
					}
				]);
			});

			it('should correctly handle an inline statement', function(){
				expect(
					new sut.Path('$foo-bar.field>?#child.field2').access
				).to.deep.equal([
					{
						loader: 'access',
						model: 'foo-bar',
						series: 'foo-bar',
						field: 'field',
						target: null,
						optional: false
					},
					{
						loader: 'include',
						model: 'child',
						series: 'child',
						field: 'field2',
						target: null,
						optional: true
					}
				]);
			});

			it('should correctly handle an incoming inline statement', function(){
				expect(
					new sut.Path('$foo-bar.field>?.incoming#child.field2').access
				).to.deep.equal([
					{
						loader: 'access',
						model: 'foo-bar',
						series: 'foo-bar',
						field: 'field',
						target: null,
						optional: false
					},
					{
						loader: 'include',
						model: 'child',
						series: 'child',
						field: 'field2',
						target: 'incoming',
						optional: true
					}
				]);
			});

			it('should correctly handle an incoming inline statement with an alias', function(){
				expect(
					new sut.Path('$foo-bar.field>?.incoming#me:child.field2').access
				).to.deep.equal([
					{
						loader: 'access',
						model: 'foo-bar',
						series: 'foo-bar',
						field: 'field',
						target: null,
						optional: false
					},
					{
						loader: 'include',
						model: 'child',
						series: 'me',
						field: 'field2',
						target: 'incoming',
						optional: true
					}
				]);
			});

			it('should properly parse a multipart string with optional and carry it', function () {
				expect(
					new sut.Path('$foo-bar.field > ?$hello-world.id > $eins-zwei').access
				).to.deep.equal([
					{
						loader: 'access',
						model: 'foo-bar',
						series: 'foo-bar',
						field: 'field',
						target: null,
						optional: false
					},
					{
						loader: 'access',
						model: 'hello-world',
						series: 'hello-world',
						field: 'id',
						target: null,
						optional: true
					},
					{
						loader: 'access',
						model: 'eins-zwei',
						series: 'eins-zwei',
						field: null,
						target: null,
						optional: true
					}
				]);

				expect(
					new sut.Path('$test-5.ownerId > ?$owner:test-1.title').access
				).to.deep.equal([
					{
						loader: 'access',
						model: 'test-5',
						series: 'test-5',
						field: 'ownerId',
						target: null,
						optional: false
					},
					{
						loader: 'access',
						model: 'test-1',
						series: 'owner',
						field: 'title',
						target: null,
						optional: true
					}
				]);
			});

			it('should properly parse method', function () {
				expect(
					new sut.Path('=helloWorld($foo-bar.eins, $hello-world.zwei)').access
				).to.deep.equal([
					{
						loader: 'method',
						optional: false,
						arguments: [
							[
								{
									loader: 'access',
									model: 'foo-bar',
									series: 'foo-bar',
									field: 'eins',
									target: null,
									optional: false
								}
							],
							[
								{
									loader: 'access',
									model: 'hello-world',
									series: 'hello-world',
									field: 'zwei',
									target: null,
									optional: false
								}
							]
						]
					}
				]);
			});
		});

		describe('.path', function () {
			it('should copy the path if it is a striing', function () {
				expect(
					new sut.Path('$foo-bar.field > $hello-world.id').path
				).to.deep.equal('$foo-bar.field > $hello-world.id');
			});

			it('should properly join into a multipart string', function () {
				const accessors = [
					{
						loader: 'access',
						model: 'foo-bar',
						series: 'foo-bar',
						field: 'field',
						target: null,
						optional: false
					},
					{
						loader: 'access',
						model: 'hello-world',
						series: 'hello-world',
						field: 'id',
						target: null,
						optional: false
					},
					{
						loader: 'access',
						model: 'eins-zwei',
						series: 'eins-zwei',
						field: 'id',
						target: null,
						optional: true
					}
				];

				expect(new sut.Path(accessors).path).to.equal(
					'$foo-bar.field>$hello-world.id>?$eins-zwei.id'
				);
			});
		});
	});
});
