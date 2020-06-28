
const expect = require('chai').expect;

const {Nexus} = require('./structure/nexus.js');
const {Complex} = require('./complex.js');

describe('src/complex.js', function(){
	let nexus = null;

	beforeEach(async function(){
		nexus = new Nexus();

		await nexus.setModel('test-1', {
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

		await nexus.setModel('test-2', {
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

		await nexus.setModel('test-3', {
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

		await nexus.setModel('test-pivot', {
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

		await nexus.setModel('test-4', {
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

		await nexus.setModel('test-5', {
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

		await nexus.setModel('test-6', {
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
			const lookup = new Complex(nexus);

			await lookup.addField('eins', 'test-1', 'name');
			await lookup.addField('zwei', 'test-2', 'name');
			await lookup.addField('drei', 'test-2', 'title');
			await lookup.addField('fier', 'test-3', 'name');

			lookup.setConnection('test-2', 'test-1');
			lookup.setConnection('test-3', 'test-2');

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
			const lookup = new Complex(nexus);

			await lookup.addField('eins', 'test-1', 'name');
			await lookup.addField('zwei', 'test-2', 'name');
			await lookup.addField('drei', 'test-2', 'title');
			await lookup.addField('fier', 'test-3', 'name');

			lookup.setConnection('test-2', 'test-1');
			lookup.setConnection('test-3', 'test-2');

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
			const lookup = new Complex(nexus);

			await lookup.addField('eins', 'test-1', 'name', {
				series: 'creator'
			});
			await lookup.addField('zwei', 'test-1', 'title', {
				series: 'creator'
			});

			await lookup.addField('drei', 'test-5', 'title');

			await lookup.addField('fier', 'test-1', 'name', {
				series: 'owner'
			});
			await lookup.addField('funf', 'test-1', 'title', {
				series: 'owner'
			});

			lookup.setConnection('test-5', 'test-1', 'creator1Id', {
				targetSeries: 'creator'
			});
			lookup.setConnection('test-5', 'test-1', 'owner1Id', {
				targetSeries: 'owner'
			});
			
			expect(await lookup.getQuery({
				'@id$creator': 123,
				'@foo$test-6>@id$test-5': 456
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
							}]
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
			const lookup = new Complex(nexus);

			/*
			{
				eins: $test-1.name as test-1_0,
				zwei: $test-2.name as test-2_0,
				drei: $test-2.title as test-2_1,
				fier: $test-3.name as test-3_0
			}
			*/
			await lookup.addField('eins', 'test-1', 'name');
			await lookup.addField('zwei', 'test-2', 'name');
			await lookup.addField('drei', 'test-2', 'title');
			await lookup.addField('fier', 'test-3', 'name');

			const inflate = lookup.getInflater({});

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
			const lookup = new Complex(nexus);

			/*
			{
				eins: $test-1.name as test-1_0,
				zwei: $test-2.name as test-2_0,
				drei: $test-2.title as test-2_1,
				fier: $test-3.name as test-3_0
			}
			*/
			await lookup.addField('eins', 'test-1', 'json');
			await lookup.addField('zwei', 'test-2', 'json');
			await lookup.addField('drei', 'test-2', 'title');
			await lookup.addField('fier', 'test-3', 'name');

			const inflate = lookup.getInflater({});

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
});
