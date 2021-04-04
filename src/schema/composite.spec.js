
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

			await lookup.link();

			const res = await lookup.getQuery({
				'$test-1.name': {
					op: '=',
					value: 'foo-bar'
				},
				'$test-3.name': {
					op: '=',
					value: 'hello-world'
				}
			});

			expect(res)
			.to.deep.equal({
				'method': 'read',
				'models': [
					{
						'name': 'test-2',
						schema: 'test-2',
						series: 'test-2',
						'fields': [{
							as: 'test-2_1',
							path: 'name'
						}, {
							as: 'test-2_2',
							path: 'title'
						}],
						query: null
					},
					{
						'name': 'test-1',
						schema: 'test-1',
						series: 'test-1',
						'fields': [{
							as: 'test-1_0',
							path: 'name'
						}],
						'query': {
							'name': {
								'op': '=',
								'value': 'foo-bar'
							}
						},
						join: {
							on: [{
								name: 'test-2',
								remote: 'test1Id',
								local: 'id'
							}]
						}
					},
					{
						'name': 'test-3',
						schema: 'test-3',
						series: 'test-3',
						'fields': [{
							as: 'test-3_3',
							path: 'name'
						}],
						'query': {
							'name': {
								'op': '=',
								'value': 'hello-world'
							}
						},
						join: {
							on: [{
								name: 'test-2',
								remote: 'id',
								local:'test2Id'
							}]
						}
					}
				]
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

			await lookup.link();

			expect(await lookup.getQuery())
			.to.deep.equal({
				'method': 'read',
				'models': [
					{
						'name': 'test-2',
						'series': 'test-2',
						'schema': 'test-2',
						'fields': [
							{
								'path': 'name',
								'as': 'test-2_1'
							},
							{
								'path': 'title',
								'as': 'test-2_2'
							}
						],
						'query': null
					},
					{
						'name': 'test-1',
						'series': 'test-1',
						'schema': 'test-1',
						'fields': [
							{
								'path': 'name',
								'as': 'test-1_0'
							}
						],
						'query': null,
						'join': {
							on: [{
								'remote': 'test1Id',
								'name': 'test-2',
								'local': 'id'
							}]
						}
					},
					{
						'name': 'test-3',
						'series': 'test-3',
						'schema': 'test-3',
						'fields': [
							{
								'path': 'name',
								'as': 'test-3_3'
							}
						],
						'query': null,
						'join': {
							on: [{
								'local': 'test2Id',
								'name': 'test-2',
								'remote': 'id'
							}]
						}
					}
				]
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

			await lookup.link();
			
			expect(await lookup.getQuery({
				'.id$creator': 123,
				'.foo$test-6>.id$test-5': 456
			}))
			.to.deep.equal({
				'method': 'read',
				'models': [
					{
						'name': 'test-5',
						'series': 'test-5',
						'schema': 'test-5',
						'fields': [
							{
								'path': 'title',
								'as': 'test-5_2'
							}
						],
						'query': null
					},
					{
						'name': 'test-1',
						'series': 'creator',
						'schema': 'test-1',
						'fields': [
							{
								'path': 'name',
								'as': 'test-1_0'
							},
							{
								'path': 'title',
								'as': 'test-1_1'
							}
						],
						'query': {
							id: 123
						},
						join: {
							on: [{
								'remote': 'creator1Id',
								'name': 'test-5',
								'local': 'id'
							}]
						}
					},
					{
						'name': 'test-1',
						'series': 'owner',
						'schema': 'test-1',
						'fields': [
							{
								'path': 'name',
								'as': 'test-1_3'
							},
							{
								'path': 'title',
								'as': 'test-1_4'
							}
						],
						'query': null,
						join: {
							on: [{
								'remote': 'owner1Id',
								'name': 'test-5',
								'local': 'id'
							}],
							optional: true
						}
					},
					{
						name: 'test-6',
						schema: 'test-6',
						series: 'test-6',
						fields: [],
						join: {
							on: [{
								local: 'table5Id',
								name: 'test-5',
								remote: 'id'
							}]
						},
						query: {
							foo: 456
						}
					}
				]
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
				'test-1_0': 'field-1',
				'test-2_1': 'field-2',
				'test-2_2': 'field-3',
				'test-3_3': 'field-4'
			});

			expect(datum)
			.to.deep.equal({
				eins: 'field-1',
				zwei: 'field-2',
				drei: 'field-3',
				fier: 'field-4'
			});
		});

		it('should work with types', async function(){
			const lookup = new Composite('blah', nexus);

			await lookup.configure({
				base: 'test-1',
				fields: {
					eins: '.json',
					zwei: '> $test-2.json',
					drei: '> $test-2.title',
					fier: '> $test-2 > $test-3.name'
				}
			});

			const inflate = await lookup.getInflater({});

			const datum = inflate({
				'test-1_0': '{"foo":"bar"}',
				'test-2_1': '{"hello":"world"}',
				'test-2_2': 'field-3',
				'test-3_3': 'field-4'
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
				fier: 'field-4'
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
