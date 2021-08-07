
const expect = require('chai').expect;

const {Nexus} = require('../env/nexus.js');
const {config} = require('./structure.js');
const {Composite} = require('./composite.js');

describe('src/schema/composite.js', function(){
	let nexus = null;

	beforeEach(async function(){
		nexus = new Nexus();

		await nexus.configureModel('test-1', {
			fields: {
				id: {
					read: true,
					key: true
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
			schema: 'table_2',
			fields: {
				id: {
					read: true,
					key: true
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
					read: true,
					key: true
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
					read: true,
					key: true
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

	describe('::getChangeType', function(){
		let sut = null;

		beforeEach(async function(){
			await nexus.configureModel('test-10', {
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

			await nexus.configureModel('test-11', {
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
					link: {
						read: true,
						link: {
							name: 'test-10',
							field: 'eins'
						}
					}
				}
			});

			sut = new Composite('foo-bar-1', nexus);
			await sut.configure({
				base: 'test-10',
				fields: {
					eins: '.eins',
					zwei: '.zwei',
					drei: '.drei',
					fier: '.fier',
					eins2: '> $test-11.eins',
					other: {
						zwei: '> $test-11.zwei'
					},
					drei2: '> $test-11.drei'
				}
			});
		});

		it('pull in a singlar value', async function(){
			expect(
				sut.getChangeType({
					zwei: 2,
					drei: 3
				})
			).to.equal(config.get('changeTypes.major'));

			expect(
				sut.getChangeType({
					other: {
						zwei: 2
					},
					drei2: 3
				})
			).to.equal(config.get('changeTypes.major'));

			expect(
				sut.getChangeType({
					eins: 1,
					drei: 3
				})
			).to.equal(config.get('changeTypes.minor'));

			expect(
				sut.getChangeType({
					eins2: 1,
					drei2: 3
				})
			).to.equal(config.get('changeTypes.minor'));

			expect(
				sut.getChangeType({
					zwei: 2
				})
			).to.equal(config.get('changeTypes.major'));

			expect(
				sut.getChangeType({
					other: {
						zwei: 2
					}
				})
			).to.equal(config.get('changeTypes.major'));

			expect(
				sut.getChangeType({
					eins: 1,
					eins2: 1
				})
			).to.equal(config.get('changeTypes.none'));

			expect(
				sut.getChangeType({
					foo: 'bar'
				})
			).to.equal(config.get('changeTypes.none'));
		});
	});

	describe('::validate', function(){
		let sut = true;

		const createMode = config.get('writeModes.create');
		const updateMode = config.get('writeModes.update');

		beforeEach(async function(){
			await nexus.configureModel('test-10', {
				fields: {
					eins: {
						update: false
					},
					zwei: {
						update: true,
						validation: {
							required: true
						}
					}
				}
			});

			await nexus.configureModel('test-11', {
				fields: {
					eins: {
						update: false
					},
					zwei: {
						update: true,
						validation: {
							required: true
						}
					},
					link: {
						read: true,
						link: {
							name: 'test-10',
							field: 'eins'
						}
					}
				}
			});

			sut = new Composite('foo-bar-1', nexus);
			await sut.configure({
				base: 'test-10',
				fields: {
					eins: '.eins',
					zwei: '.zwei',
					eins2: '> $test-11.eins',
					other: {
						zwei: '> $test-11.zwei'
					}
				}
			});
		});

		it('should work on create', async function(){
			expect(
				sut.validate({
					eins: 1,
					zwei: 2,
					eins2: 1,
					other: {
						zwei: 3
					}
				}, createMode)
			).to.deep.equal([]);

			expect(
				sut.validate({
					eins: 1,
					fier: 4
				}, createMode)
			).to.deep.equal([
				{path: 'zwei', message: 'can not be empty'},
				{path: 'other.zwei', message: 'can not be empty'}
			]);

			expect(
				sut.validate({
					eins: 1,
					zwei: 2
				}, createMode)
			).to.deep.equal([
				{path: 'other.zwei', message: 'can not be empty'}
			]);
		});

		it('should work on update', async function(){
			expect(
				sut.validate({
					eins: 1, 
					zwei: 2, 
					other: {
						zwei: 2
					}
				}, updateMode)
			).to.deep.equal([]);

			expect(
				sut.validate({
					eins: 1, 
					eins2: 1
				}, updateMode)
			).to.deep.equal([]);

			expect(
				sut.validate({
					eins: 1, 
					zwei: null, 
					other: {
						zwei: null
					}
				}, updateMode)
			).to.deep.equal([
				{path: 'zwei', message: 'can not be empty'},
				{path: 'other.zwei', message: 'can not be empty'}
			]);
		});
	});

	describe('::getQuery', function(){
		// TODO: run this against models that have alias schemas
		it('should work', async function(){
			const lookup = new Composite('foo-bar', nexus);

			await nexus.configureModel('my-model', {
				schema: 'a_schema',
				fields: {
					id: {
						key: true,
						read: true
					},
					name: {
						read: true
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

			await lookup.configure({
				base: 'test-1',
				fields: {
					eins: '.name',
					zwei: '> $test-2.name',
					drei: '> $test-2.title',
					fier: '> $test-2 > $test-3.name',
					aliased: '> $my-model.name'
				}
			});

			const query = await lookup.getQuery({
				joins: {
					'$test-1.name': 'foo-bar',
					'$test-3.name': {
						'eq': 'hello-world'
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
					schema: 'table_2',
					joins: [{
						name: 'test-1',
						optional: false,
						mappings: [{
							from: 'test1Id',
							to: 'id'
						}]
					}]
				}, {
					series: 'my-model',
					schema: 'a_schema',
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
					series: 'my-model',
					as: 'aliased',
					path: 'name'
				}, {
					series: 'test-3',
					as: 'fier',
					path: 'name'
				}],
				params: [{
					series: 'test-1',
					path: 'name',
					operation: '=',
					value: 'foo-bar',
					settings: {}
				},{
					series: 'test-3',
					path: 'name',
					operation: 'eq',
					value: 'hello-world',
					settings: {}
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
					schema: 'table_2',
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
					'.id$creator:test-1': 123,
					'.foo$junk:test-6>.id$test-5': {
						gt: 456,
						lt: 789
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
					operation: '=',
					value: 123,
					settings: {}
				}, {
					series: 'junk',
					path: 'foo',
					operation: 'gt',
					value: 456,
					settings: {}
				}, {
					series: 'junk',
					path: 'foo',
					operation: 'lt',
					value: 789,
					settings: {}
				}]
			});
		});
	});

	describe('::calculateDynamics', function(){
		it('should work', async function(){
			const lookup = new Composite('foo-bar', nexus);

			await lookup.configure({
				base: 'test-1',
				key: 'id',
				fields: {
					eins: '.name',
					zwei: '> $test-2.name',
					drei: '> $test-2.title',
					fier: '> $test-2 > $test-3.name'
				},
				dynamics: {
					foo: function(datum, variables){
						return variables.one + variables.two;
					},
					hello: {
						world: function(datum){
							return datum.eins+':'+datum.zwei;
						}
					}
				}
			});

			const datum = {
				eins: 'eins',
				zwei: 'zwei'
			};

			lookup.calculateDynamics(datum, {one: 1, two: 2});

			expect(datum)
			.to.deep.equal({
				eins: 'eins',
				zwei: 'zwei',
				foo: 3,
				hello: {
					world: 'eins:zwei'
				}
			});
		});
	});

	describe('::getKeyQueryByModel', function(){
		it('should work', async function(){
			const lookup = new Composite('foo-bar', nexus);

			await lookup.configure({
				base: 'test-1',
				key: 'id',
				fields: {
					eins: '.name',
					zwei: '> $test-2.name',
					drei: '> $test-2.title',
					fier: '> $test-2 > $test-3.name'
				}
			});

			let query = await lookup.getKeyQueryByModel('test-1', 1, {});

			expect(query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-1',
					schema: 'test-1',
					joins: []
				}],
				fields: [{
					series: 'test-1',
					as: 'key',
					path: 'id'
				}],
				params: [{
					series: 'test-1',
					path: 'id',
					operation: '=',
					value: 1,
					settings: {}
				}]
			});

			query = await lookup.getKeyQueryByModel('test-2', 2, {});

			expect(query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-1',
					schema: 'test-1',
					joins: []
				}, {
					series: 'test-2',
					schema: 'table_2',
					joins: [{
						name: 'test-1',
						optional: false,
						mappings: [{
							from: 'test1Id',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-1',
					as: 'key',
					path: 'id'
				}],
				params: [{
					series: 'test-2',
					path: 'id',
					operation: '=',
					value: 2,
					settings: {}
				}]
			});

			query = await lookup.getKeyQueryByModel('test-3', 3, {});

			expect(query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-1',
					schema: 'test-1',
					joins: []
				}, {
					series: 'test-2',
					schema: 'table_2',
					joins: [{
						name: 'test-1',
						optional: false,
						mappings: [{
							to: 'id',
							from: 'test1Id'
						}]
					}]
				}, {
					series: 'test-3',
					schema: 'test-3',
					joins: [{
						name: 'test-2',
						optional: false,
						mappings: [{
							to: 'id',
							from: 'test2Id'
						}]
					}]
				}],
				fields: [{
					series: 'test-1',
					as: 'key',
					path: 'id'
				}],
				params: [{
					series: 'test-3',
					path: 'id',
					operation: '=',
					value: 3,
					settings: {}
				}]
			});
		});

		it('should succeed with a alias alignment', async function(){
			const lookup = new Composite('foo-bar', nexus);

			await lookup.configure({
				base: 'test-5',
				key: 'id',
				fields: {
					eins: '.creator1Id > $creator:test-1.name',
					zwei: '.creator1Id > $creator:test-1.title',
					drei: '.title',
					fier: '.owner1Id > ?$owner:test-1.name',
					funf: '.owner1Id > ?$owner:test-1.title'
				}
			});
			
			let query = await lookup.getKeyQueryByModel('test-1', 123);

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
				}],
				fields: [{
					series: 'test-5',
					as: 'key',
					path: 'id'
				}],
				params: [{
					series: 'creator',
					path: 'id',
					operation: '=',
					value: 123,
					settings: {}
				}, {
					series: 'owner',
					path: 'id',
					operation: '=',
					value: 123,
					settings: {}
				}]
			});
		});
	});

	describe('::getKeyQueryBySub', function(){
		it('should work', async function(){
			const sub = new Composite('sub', nexus);

			await sub.configure({
				base: 'test-4',
				key: 'id',
				fields: {
					eins: '.name',
					title: '.title'
				}
			});

			nexus.loadComposite = async function(name){
				expect(name)
				.to.equal('sub');

				return sub;
			};

			const lookup = new Composite('foo-bar', nexus);

			await lookup.configure({
				base: 'test-1',
				key: 'id',
				fields: {
					eins: '.name',
					title: '.title',
					zwei: '> $test-2.name',
					subs: ['> $test-2 > $test-3 > $test-pivot > #sub']
				}
			});

			let query = await lookup.getKeyQueryBySub('sub', 3, {});

			expect(query.toJSON())
			.to.deep.equal({
				models: [
					{
						'series': 'test-1',
						'schema': 'test-1',
						'joins': []
					},
					{
						'series': 'test-2',
						'schema': 'table_2',
						'joins': [
							{
								'name': 'test-1',
								'mappings': [
									{
										'from': 'test1Id',
										'to': 'id'
									}
								],
								'optional': false
							}
						]
					},
					{
						'series': 'test-3',
						'schema': 'test-3',
						'joins': [
							{
								'name': 'test-2',
								'mappings': [
									{
										'from': 'test2Id',
										'to': 'id'
									}
								],
								'optional': false
							}
						]
					},
					{
						'series': 'test-pivot',
						'schema': 'test-pivot',
						'joins': [
							{
								'name': 'test-3',
								'mappings': [
									{
										'from': 'test3Id',
										'to': 'id'
									}
								],
								'optional': false
							}
						]
					},
					{
						'series': 'sub',
						'schema': 'test-4',
						'joins': [
							{
								'name': 'test-pivot',
								'mappings': [
									{
										'from': 'id',
										'to': 'test4Id'
									}
								],
								'optional': false
							}
						]
					}
				],
				fields: [
					{
						'series': 'test-1',
						'path': 'id',
						'as': 'key'
					}
				],
				params: [
					{
						'series': 'sub',
						'path': 'id',
						'operation': '=',
						'value': 3,
						'settings': {}
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
