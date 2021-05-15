
const expect = require('chai').expect;

const {Nexus} = require('../env/nexus.js');
const {Composite} = require('./composite.js');

describe('src/schema/composite.js', function(){
	let nexus = null;

	beforeEach(async function(){
		nexus = new Nexus();

		await nexus.configureModel('test-1', {
			fields: {
				id: {
					read: true
				},
				name: {
					read: true
				},
				json: {
					type: 'json'
				},
				title: {
					read: true
				}
			}
		});

		await nexus.configureModel('test-2', {
			fields: {
				id: {
					read: true
				},
				name: {
					read: true
				},
				title: {
					read: true
				},
				json: {
					type: 'json'
				},
				test1Id: {
					read: true,
					link: {
						name: 'test-1',
						field: 'id'
					}
				}
			}
		});

		await nexus.configureModel('test-3', {
			fields: {
				id: {
					read: true
				},
				name: {
					read: true
				},
				title: {
					read: true
				},
				test2Id: {
					read: true,
					link: {
						name: 'test-2',
						field: 'id'
					}
				}
			}
		});

		await nexus.configureModel('test-pivot', {
			fields: {
				id: {
					read: true
				},
				test3Id: {
					read: true,
					link: {
						name: 'test-3',
						field: 'id'
					}
				},
				test4Id: {
					read: true,
					link: {
						name: 'test-4',
						field: 'id'
					}
				}
			}
		});

		await nexus.configureModel('test-4', {
			fields: {
				id: {
					read: true
				},
				name: {
					read: true
				},
				title: {
					read: true
				}
			}
		});

		await nexus.configureModel('test-5', {
			fields: {
				id: {
					read: true
				},
				name: {
					read: true
				},
				title: {
					read: true
				},
				owner1Id: {
					read: true,
					link: {
						name: 'test-1',
						field: 'id'
					}
				},
				creator1Id: {
					read: true,
					link: {
						name: 'test-1',
						field: 'id'
					}
				}
			}
		});

		await nexus.configureModel('test-6', {
			fields: {
				table5Id: {
					read: true,
					link: {
						name: 'test-5',
						field: 'id'
					}
				}
			}
		});
	});

	describe('::getQuery', function(){
		it('should work', async function(){
			const lookup = new Composite('foo-bar', nexus);

			await lookup.configure({
				base: 'test-1',
				fields: {
					eins: '.name',
					zwei: '> $test-2.name',
					drei: '> $test-2.title',
					fier: '> $test-2 > $test-3.name'
				}
			});

			const query = await lookup.getQuery({
				joins: {
					'$test-1.name': {
						op: '=',
						value: 'foo-bar'
					},
					'$test-3.name': {
						op: '=',
						value: 'hello-world'
					}
				}
			});

			expect(query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-1',
					schema: 'test-1',
					joins: []
				}, {
					series: 'test-2',
					schema: 'test-2',
					joins: [{
						name: 'test-1',
						optional: false,
						mappings: [{
							from: 'test1Id',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-3',
					schema: 'test-3',
					joins: [{
						name: 'test-2',
						optional: false,
						mappings: [{
							from: 'test2Id',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-1',
					as: 'eins',
					path: 'name'
				}, {
					series: 'test-2',
					as: 'zwei',
					path: 'name'
				}, {
					series: 'test-2',
					as: 'drei',
					path: 'title'
				}, {
					series: 'test-3',
					as: 'fier',
					path: 'name'
				}],
				params: [{
					series: 'test-1',
					path: 'name',
					operation: {
						op: '=',
						value: 'foo-bar'
					}
				},{
					series: 'test-3',
					path: 'name',
					operation: {
						op: '=',
						value: 'hello-world'
					}
				}]
			});
		});

		it('should succeed with a basic alignment', async function(){
			const lookup = new Composite('foo-bar', nexus);

			await lookup.configure({
				base: 'test-1',
				fields: {
					eins: '.name',
					zwei: '> $test-2.name',
					drei: '> $test-2.title',
					fier: '> $test-2 > $test-3.name'
				}
			});

			const query = await lookup.getQuery();

			expect(query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-1',
					schema: 'test-1',
					joins: []
				}, {
					series: 'test-2',
					schema: 'test-2',
					joins: [{
						name: 'test-1',
						optional: false,
						mappings: [{
							from: 'test1Id',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-3',
					schema: 'test-3',
					joins: [{
						name: 'test-2',
						optional: false,
						mappings: [{
							from: 'test2Id',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-1',
					as: 'eins',
					path: 'name'
				}, {
					series: 'test-2',
					as: 'zwei',
					path: 'name'
				}, {
					series: 'test-2',
					as: 'drei',
					path: 'title'
				}, {
					series: 'test-3',
					as: 'fier',
					path: 'name'
				}],
				params: []
			});
		});

		it('should succeed with a alias alignment', async function(){
			const lookup = new Composite('foo-bar', nexus);

			await lookup.configure({
				base: 'test-5',
				fields: {
					eins: '.creator1Id > $creator:test-1.name',
					zwei: '.creator1Id > $creator:test-1.title',
					drei: '.title',
					fier: '.owner1Id > ?$owner:test-1.name',
					funf: '.owner1Id > ?$owner:test-1.title'
				}
			});
			
			const query = await lookup.getQuery({
				joins: {
					'.id$creator:test-1': {
						value: 123
					},
					'.foo$junk:test-6>.id$test-5': {
						value: 456
					}
				}
			});

			expect(query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-5',
					schema: 'test-5',
					joins: []
				}, {
					series: 'creator',
					schema: 'test-1',
					joins: [{
						name: 'test-5',
						optional: false,
						mappings: [{
							from: 'id',
							to: 'creator1Id'
						}]
					}]
				}, {
					series: 'owner',
					schema: 'test-1',
					joins: [{
						name: 'test-5',
						optional: true,
						mappings: [{
							from: 'id',
							to: 'owner1Id'
						}]
					}]
				}, {
					series: 'junk',
					schema: 'test-6',
					joins: [{
						name: 'test-5',
						optional: false,
						mappings: [{
							from: 'table5Id',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-5',
					as: 'drei',
					path: 'title'
				}, {
					series: 'creator',
					as: 'eins',
					path: 'name'
				}, {
					series: 'creator',
					as: 'zwei',
					path: 'title'
				}, {
					series: 'owner',
					as: 'fier',
					path: 'name'
				}, {
					series: 'owner',
					as: 'funf',
					path: 'title'
				}],
				params: [{
					series: 'creator',
					path: 'id',
					operation: {
						value: 123
					}
				}, {
					series: 'junk',
					path: 'foo',
					operation: {
						value: 456
					}
				}]
			});
		});
	});
	
	describe('::getInflater', function(){
		it('should work', async function(){
			const lookup = new Composite('blah', nexus);

			await lookup.configure({
				base: 'test-1',
				fields: {
					eins: '.name',
					zwei: '> $test-2.name',
					drei: '> $test-2.title',
					fier: '> $test-2 > $test-3.name'
				}
			});

			const inflate = await lookup.getInflater({});

			const datum = inflate({
				'eins': 'field-1',
				'zwei': 'field-2',
				'drei': 'field-3',
				'fier': 'field-4'
			});

			expect(datum)
			.to.deep.equal({
				eins: 'field-1',
				zwei: 'field-2',
				drei: 'field-3',
				fier: 'field-4'
			});
		});

		it('should work with types and isFlat', async function(){
			const lookup = new Composite('blah', nexus);

			await lookup.configure({
				base: 'test-1',
				isFlat: true,
				fields: {
					eins: '.json',
					zwei: '> $test-2.json',
					drei: '> $test-2.title',
					fier: {
						value: '> $test-2 > $test-3.name'
					}
				}
			});

			const inflate = await lookup.getInflater({});

			const datum = inflate({
				'eins': '{"foo":"bar"}',
				'zwei': '{"hello":"world"}',
				'drei': 'field-3',
				'fier.value': 'field-4'
			});

			expect(datum)
			.to.deep.equal({
				eins: {
					foo: 'bar'
				},
				zwei: {
					hello: 'world'
				},
				drei: 'field-3',
				fier: {
					value: 'field-4'
				}
			});
		});

		it('should work with types and isFlat:false', async function(){
			const lookup = new Composite('blah', nexus);

			await lookup.configure({
				base: 'test-1',
				isFlat: false,
				fields: {
					eins: '.json',
					zwei: '> $test-2.json',
					drei: '> $test-2.title',
					fier: {
						value: '> $test-2 > $test-3.name'
					}
				}
			});

			const inflate = await lookup.getInflater({});

			const datum = inflate({
				'eins': '{"foo":"bar"}',
				'zwei': '{"hello":"world"}',
				'drei': 'field-3',
				'fier': {
					value: 'field-4'
				}
			});

			expect(datum)
			.to.deep.equal({
				eins: {
					foo: 'bar'
				},
				zwei: {
					hello: 'world'
				},
				drei: 'field-3',
				fier: {
					value: 'field-4'
				}
			});
		});
	});

	describe('schema', function(){
		it('should define the correct properties', async function(){
			const comp = new Composite('test', nexus);

			await comp.configure({
				base: 'test-2',
				key: 'id',
				fields: {
					name: '.name',
					foo: {
						bar: '.title'
					}
				}
			});

			await comp.link();

			const test = comp.fields.map(
				field => field.toJSON()
			);

			expect(test)
			.to.deep.equal([{
				path: 'name',
				storage: {
					schema: 'test-2',
					path: 'name'
				},
				usage: {
					type: undefined,
					description: undefined
				}
			}, {
				path: 'foo.bar',
				storage: {
					schema: 'test-2',
					path: 'title'
				},
				usage: {
					type: undefined,
					description: undefined
				}
			}]);
		});

		describe('extends', function(){
			it('should pull in all the extended fields', async function(){
				await nexus.configureComposite('base', {
					base: 'test-1',
					key: 'id',
					fields: {
						name: '.name'
					}
				});

				const comp = new Composite('extends', nexus);

				await comp.configure({
					base: 'test-2',
					key: 'id',
					extends: 'base',
					fields: {
						myName: '.name'
					}
				});

				await comp.link();

				const test = comp.fields.map(
					field => field.toJSON()
				);

				expect(test)
				.to.deep.equal([{
					path: 'myName',
					storage: {
						schema: 'test-2',
						path: 'name'
					},
					usage: {
						type: undefined,
						description: undefined
					}
				}, {
					path: 'name',
					storage: {
						schema: 'test-1',
						path: 'name'
					},
					usage: {
						type: undefined,
						description: undefined
					}
				}]);
			});

			it('should be able to extend an extension', async function(){
				await nexus.configureComposite('base', {
					base: 'test-1',
					key: 'id',
					fields: {
						name: '.name'
					}
				});

				await nexus.configureComposite('extends', {
					base: 'test-2',
					key: 'id',
					extends: 'base',
					fields: {
						myName: '.name'
					}
				});

				const comp = new Composite('uber-extends', nexus);

				await comp.configure({
					base: 'test-3',
					key: 'id',
					extends: 'extends',
					fields: {
						reallyMyName: '.name'
					}
				});

				await comp.link();

				const test = comp.fields.map(
					field => field.toJSON()
				);

				expect(test)
				.to.deep.equal([{
					path: 'reallyMyName',
					storage: {
						schema: 'test-3',
						path: 'name'
					},
					usage: {
						type: undefined,
						description: undefined
					}
				},{
					path: 'myName',
					storage: {
						schema: 'test-2',
						path: 'name'
					},
					usage: {
						type: undefined,
						description: undefined
					}
				}, {
					path: 'name',
					storage: {
						schema: 'test-1',
						path: 'name'
					},
					usage: {
						type: undefined,
						description: undefined
					}
				}]);
			});
		});
	});
});
