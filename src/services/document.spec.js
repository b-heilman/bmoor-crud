
const {expect} = require('chai');
const sinon = require('sinon');
const {Config} = require('bmoor/src/lib/config.js');

const {Nexus, config} = require('../env/nexus.js');
const {Context} = require('../server/context.js');
const normalization = require('./normalization.js');
	
describe('src/services/document.js', function(){
	const sut = require('./document.js');

	let nexus = null;
	let stubs = null;
	let context = null;
	
	let connector = null;
	let permissions = null;
	let connectorExecute = null;

	const changeTypes = require('../schema/structure.js').config.get('changeTypes');

	beforeEach(function(){
		stubs = {};
		
		connector = {
			execute: (...args) => stubs.execute(...args)
		};

		const connectors = new Config({
			stub: function(){
				return connector;
			}
		});

		permissions = {};

		context = new Context({method: 'get'});
		context.hasPermission = (perm) => !!permissions[perm];

		stubs = {
			execute: sinon.stub()
			.callsFake(async function(){
				return connectorExecute;
			})
		};

		config.set('timeout', 500);
		
		nexus = new Nexus(null, connectors);
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => {
			if (stub.restore){
				stub.restore();
			}
		});
	});

	beforeEach(async function(){
		await nexus.configureModel('test-user', {
			connector: 'stub',
			fields: {
				id: {
					read: true,
					key: true
				},
				name: true
			}
		});
		await nexus.configureCrud('test-user', {});

		await nexus.configureModel('test-item', {
			connector: 'stub',
			fields: {
				id: {
					read: true,
					key: true
				},
				name: {
					create: true,
					read: true,
					update: true,
					updateType: changeTypes.major
				},
				title: {
					create: true,
					read: true,
					update: true,
					updateType: changeTypes.minor
				},
				json: {
					read: true,
					usage: 'json',
					updateType: changeTypes.none
				},
				creatorId: {
					read: true,
					link: {
						name: 'test-user',
						field: 'id'
					}
				},
				ownerId: {
					read: true,
					link: {
						name: 'test-user',
						field: 'id'
					}
				}
			}
		});
		await nexus.configureCrud('test-item', {});

		await nexus.configureModel('test-material', {
			connector: 'stub',
			fields: {
				id: {
					read: true,
					key: true
				},
				name: {
					create: true,
					read: true,
					update: true,
					updateType: changeTypes.major
				},
				title: {
					create: true,
					read: true,
					update: true,
					updateType: changeTypes.minor
				},
				creatorId: {
					read: true,
					link: {
						name: 'test-user',
						field: 'id'
					}
				}
			}
		});
		await nexus.configureCrud('test-material', {});

		await nexus.configureModel('test-item-material', {
			connector: 'stub',
			fields: {
				id: {
					read: true,
					key: true
				},
				itemId: {
					read: true,
					create: true,
					link: {
						name: 'test-item',
						field: 'id'
					}
				},
				materialId: {
					read: true,
					create: true,
					link: {
						name: 'test-material',
						field: 'id'
					}
				},
				tag: {
					read: true,
					write: true,
					update: true,
					updateType: changeTypes.major
				},
				mask: {
					read: true,
					write: true,
					update: true,
					updateType: changeTypes.minor
				},
				note: {
					read: true,
					write: true,
					update: true,
					updateType: changeTypes.none
				},
				creatorId: {
					read: true,
					link: {
						name: 'test-user',
						field: 'id'
					}
				}
			}
		});
		await nexus.configureCrud('test-item-material', {});

		await nexus.configureModel('test-person', {
			connector: 'stub',
			fields: {
				id: true,
				name: true,
				json: {
					read: true,
					usage: 'json'
				},
				itemId: {
					read: true,
					write: true,
					link: {
						name: 'test-item',
						field: 'id'
					}
				}
			}
		});
		await nexus.configureCrud('test-person', {});

		await nexus.configureModel('test-family', {
			connector: 'stub',
			fields: {
				id: {
					read: true,
					key: true
				},
				name: true
			}
		});
		await nexus.configureCrud('test-family', {});

		await nexus.configureModel('test-category', {
			connector: 'stub',
			fields: {
				id: {
					read: true,
					key: true
				},
				name: true,
				json: {
					read: 'admin',
					usage: 'json'
				},
				itemId: {
					read: true,
					write: true,
					link: {
						name: 'test-item',
						field: 'id'
					}
				},
				familyId: {
					read: true,
					write: true,
					link: {
						name: 'test-family',
						field: 'id'
					}
				}
			}
		});
		await nexus.configureCrud('test-category', {});

		await nexus.configureModel('test-tag', {
			connector: 'stub',
			fields: {
				id: {
					read: true,
					key: true
				},
				name: {
					read: true,
					write: true,
					update: true
				},
				required: {
					read: true,
					write: true,
					update: true,
					validation: {
						required: true
					}
				},
				categoryId: {
					read: true,
					write: true,
					link: {
						name: 'test-category',
						field: 'id'
					}
				}
			}
		});
		await nexus.configureCrud('test-tag', {});

		await nexus.configureComposite('test-composite-item', {
			base: 'test-item',
			joins: [
				'> $test-category'
			],
			fields: {
				'id': '.id',
				'item': '.name',
				'categoryId': '$test-category.id',
				'categoryName':  '$test-category.name'
			}
		});

		await nexus.configureDocument('test-composite-item', connector);

		await nexus.configureComposite('test-composite-tag', {
			base: 'test-tag',
			joins: [],
			fields: {
				'name': '.name',
				'required': '.required'
			}
		});

		await nexus.configureDocument('test-composite-tag', connector);

		await nexus.configureModel('test-user-family-pivot', {
			fields: {
				id: {
					read: true,
					key: true
				},
				userId: {
					read: true,
					write: true,
					link: {
						name: 'test-user',
						field: 'id'
					}
				},
				familyId: {
					read: true,
					write: true,
					link: {
						name: 'test-family',
						field: 'id'
					}
				}
			}
		});
	});

	describe('::read', function(){
		it('should properly generate a sql request', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'personName': 'person-1',
				'categoryName': 'category-1'
			}];

			nexus.configureComposite('test-1', {
				base: 'test-item',
				joins: [
					'>? $test-person',
					'> $test-category'
				],
				fields: {
					'item': '.name',
					'personName': '$test-person.name',
					'categoryName':  '$test-category.name'
				}
			});
			
			const comp = await nexus.loadComposite('test-1');

			const doc = new sut.Document(comp);

			await doc.configure();

			await doc.link();
			
			const res = await doc.read(1, context);
			
			const args = stubs.execute.getCall(0).args[0];

			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-person',
					schema: 'test-person',
					joins: [{
						name: 'test-item',
						optional: true,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					as: 'item',
					path: 'name'
				}, {
					series: 'test-person',
					as: 'personName',
					path: 'name'
				}, {
					series: 'test-category',
					as: 'categoryName',
					path: 'name'
				}],
				params: [{
					series: 'test-item',
					path: 'id',
					operation: '=',
					settings: {},
					value: 1
				}]
			});

			expect(res)
			.to.deep.equal({
				item: 'item-1',
				personName: 'person-1',
				categoryName: 'category-1'
			});
		});

		it('should properly encode', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'personName': 'person-1',
				'categoryName': 'category-1'
			}];

			nexus.configureComposite('test-1', {
				base: 'test-item',
				joins: [
					'>? $test-person',
					'> $test-category'
				],
				fields: {
					'item': '.name',
					'personName': '$test-person.name',
					'categoryName':  '$test-category.name'
				},
				encode: function(datum){
					expect(datum)
					.to.deep.equal({
						item: 'item-1',
						personName: 'person-1',
						categoryName: 'category-1'
					});

					return {foo: 'bar'};
				}
			});
			
			const comp = await nexus.loadComposite('test-1');

			const doc = new sut.Document(comp);

			await doc.configure();

			await doc.link();
			
			const res = await doc.read(1, context);
			
			const args = stubs.execute.getCall(0).args[0];

			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-person',
					schema: 'test-person',
					joins: [{
						name: 'test-item',
						optional: true,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					as: 'item',
					path: 'name'
				}, {
					series: 'test-person',
					as: 'personName',
					path: 'name'
				}, {
					series: 'test-category',
					as: 'categoryName',
					path: 'name'
				}],
				params: [{
					series: 'test-item',
					path: 'id',
					operation: '=',
					settings: {},
					value: 1
				}]
			});

			expect(res)
			.to.deep.equal({foo: 'bar'});
		});

		it('should properly inflate a data response, without security', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'personInfo': '{"foo":"bar"}',
				'category': '{"hello":"world"}'
			}];

			nexus.configureComposite('test-1', {
				base: 'test-item',
				joins: [
					'> $test-person',
					'> $test-category'
				],
				fields: {
					'item': '.name',
					'personInfo': '$test-person.json',
					'categoryInfo':  '$test-category.json'
				}
			});

			const comp = await nexus.loadComposite('test-1');
			
			const doc = new sut.Document(comp);

			await doc.configure(connector);
			await doc.link();
			
			const res = await doc.read(1, context);
			
			const args = stubs.execute.getCall(0).args[0];
			
			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-person',
					schema: 'test-person',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					as: 'item',
					path: 'name'
				}, {
					series: 'test-person',
					as: 'personInfo',
					path: 'json'
				}],
				params: [{
					series: 'test-item',
					path: 'id',
					operation: '=',
					settings: {},
					value: 1
				}]
			});

			expect(res)
			.to.deep.equal({
				item: 'item-1',
				personInfo: {
					foo: 'bar'
				}
			});
		});

		it('should properly inflate a data response, with security', async function(){
			permissions = {admin: true};

			connectorExecute = [{
				'item': 'item-1',
				'personInfo': '{"foo":"bar"}',
				'categoryInfo': '{"hello":"world"}'
			}];

			nexus.configureComposite('test-1', {
				base: 'test-item',
				joins: [
					'> $test-person',
					'> $test-category'
				],
				fields: {
					'item': '.name',
					'personInfo': '$test-person.json',
					'categoryInfo':  '$test-category.json'
				}
			});
			
			const comp = await nexus.loadComposite('test-1');

			const doc = new sut.Document(comp);

			await doc.configure(connector);
			await doc.link();

			const res = await doc.read(1, context);
			
			const args = stubs.execute.getCall(0).args[0];
			
			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-person',
					schema: 'test-person',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					as: 'item',
					path: 'name'
				}, {
					series: 'test-person',
					as: 'personInfo',
					path: 'json'
				}, {
					series: 'test-category',
					as: 'categoryInfo',
					path: 'json'
				}],
				params: [{
					series: 'test-item',
					path: 'id',
					operation: '=',
					settings: {},
					value: 1
				}]
			});

			expect(res)
			.to.deep.equal({
				item: 'item-1',
				personInfo: {
					foo: 'bar'
				},
				categoryInfo: {
					hello: 'world'
				}
			});
		});

		it('with work with join and aliases', async function(){
			nexus.configureComposite('test-1', {
				base: 'test-item',
				joins: [
					'> $test-person',
					'.ownerId > $owner:test-user',
					'.creatorId > $creator:test-user'
				],
				fields: {
					'item': '.name',
					'personName': '$test-person.name',
					'ownerName': '$owner.name',
					'creatorName': '$creator.name'
				}
			});
			
			connectorExecute = [{
				'item': 'item-1',
				'personName': 'personName',
				'ownerName': 'user2',
				'creatorName': 'user3'
			}];

			const comp = await nexus.loadComposite('test-1');

			const doc = new sut.Document(comp);

			await doc.configure(connector);
			await doc.link();

			const res = await doc.read(1, context);

			const args = stubs.execute.getCall(0).args[0];
			
			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-person',
					schema: 'test-person',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'owner',
					schema: 'test-user',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'id',
							to: 'ownerId'
						}]
					}]
				}, {
					series: 'creator',
					schema: 'test-user',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'id',
							to: 'creatorId'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					as: 'item',
					path: 'name'
				}, {
					series: 'test-person',
					as: 'personName',
					path: 'name'
				}, {
					series: 'owner',
					as: 'ownerName',
					path: 'name'
				}, {
					series: 'creator',
					as: 'creatorName',
					path: 'name'
				}],
				params: [{
					series: 'test-item',
					path: 'id',
					operation: '=',
					settings: {},
					value: 1
				}]
			});

			expect(res)
			.to.deep.equal({
				item: 'item-1',
				personName: 'personName',
				ownerName: 'user2',
				creatorName: 'user3'
			});
		});
	});

	describe('::readAll', function(){
		it('should properly generate a sql request', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'personName': 'person-1',
				'categoryName': 'category-1'
			}];

			nexus.configureComposite('test-1', {
				base: 'test-item',
				joins: [
					'>? $test-person',
					'> $test-category'
				],
				fields: {
					'item': '.name',
					'personName': '$test-person.name',
					'categoryName':  '$test-category.name'
				}
			});
			
			const comp = await nexus.loadComposite('test-1');

			const doc = new sut.Document(comp);

			await doc.configure();

			await doc.link();
			
			const res = await doc.readAll(context);
			
			const args = stubs.execute.getCall(0).args[0];

			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-person',
					schema: 'test-person',
					joins: [{
						name: 'test-item',
						optional: true,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					as: 'item',
					path: 'name'
				}, {
					series: 'test-person',
					as: 'personName',
					path: 'name'
				}, {
					series: 'test-category',
					as: 'categoryName',
					path: 'name'
				}],
				params: []
			});

			expect(res)
			.to.deep.equal([{
				item: 'item-1',
				personName: 'person-1',
				categoryName: 'category-1'
			}]);
		});
	});

	describe('::readMany', function(){
		it('should properly generate a sql request', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'personName': 'person-1',
				'categoryName': 'category-1'
			}];

			nexus.configureComposite('test-1', {
				base: 'test-item',
				joins: [
					'>? $test-person',
					'> $test-category'
				],
				fields: {
					'item': '.name',
					'personName': '$test-person.name',
					'categoryName':  '$test-category.name'
				}
			});
			
			const comp = await nexus.loadComposite('test-1');

			const doc = new sut.Document(comp);

			await doc.configure();

			await doc.link();
			
			const res = await doc.readMany([1,2,3], context);
			
			const args = stubs.execute.getCall(0).args[0];

			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-person',
					schema: 'test-person',
					joins: [{
						name: 'test-item',
						optional: true,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					as: 'item',
					path: 'name'
				}, {
					series: 'test-person',
					as: 'personName',
					path: 'name'
				}, {
					series: 'test-category',
					as: 'categoryName',
					path: 'name'
				}],
				params: [{
					series: 'test-item',
					path: 'id',
					operation: '=',
					settings: {},
					value: [1,2,3]
				}]
			});

			expect(res)
			.to.deep.equal([{
				item: 'item-1',
				personName: 'person-1',
				categoryName: 'category-1'
			}]);
		});
	});

	describe('::query', function(){
		it('should handle a sub', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'categoryName': 'category-1',
				'tag': 'tag-1',
				'mask': 'mask-1',
				'sub_0': 123
			}];

			nexus.configureComposite('test-tags', {
				base: 'test-item-material',
				joins: [
				],
				fields: {
					'tag': '.tag',
					'mask': '.mask'
				}
			});

			await nexus.configureDocument('test-tags');

			nexus.configureComposite('test-1', {
				base: 'test-item',
				joins: [
					'> $test-category',
					'> #test-tags'
				],
				fields: {
					'item': '.name',
					'categoryName':  '$test-category.name',
					'tags': ['#test-tags']
				}
			});
			
			const comp = await nexus.loadComposite('test-1');

			const doc = new sut.Document(comp);

			await doc.configure();
			
			const res = await doc.query({}, context);
			
			const args = stubs.execute.getCall(0).args[0];

			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					path: 'name',
					as: 'item'
				}, {
					series: 'test-item',
					path: 'id',
					as: 'sub_0'
				}, {
					series: 'test-category',
					path: 'name',
					as: 'categoryName'
				}],
				params: []
			});

			const args2 = stubs.execute.getCall(1).args[0];

			expect(args2.method)
			.to.equal('read');

			expect(args2.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item-material',
					schema: 'test-item-material',
					joins: []
				}],
				fields: [{
					series: 'test-item-material',
					path: 'tag',
					as: 'tag'
				}, {
					series: 'test-item-material',
					path: 'mask',
					as: 'mask'
				}],
				params: [{
					series: 'test-item-material',
					path: 'itemId',
					operation: '=',
					settings: {},
					value: 123
				}]
			});

			expect(res)
			.to.deep.equal([{
				item: 'item-1',
				categoryName: 'category-1',
				tags: [{
					tag: 'tag-1',
					mask: 'mask-1'
				}]
			}]);
		});

		it('should handle a sub with a pivot', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'categoryName': 'category-1',
				'name': 'name-1',
				'sub_0': 123
			}];

			nexus.configureComposite('test-stuff', {
				base: 'test-material',
				joins: [],
				fields: {
					'name': '.name'
				}
			});

			await nexus.configureDocument('test-stuff');

			nexus.configureComposite('test-1', {
				base: 'test-item',
				joins: [
					'> $test-category',
					'> $test-item-material > #test-stuff'
				],
				fields: {
					'item': '.name',
					'categoryName':  '$test-category.name',
					'stuff': ['#test-stuff']
				}
			});
			
			const comp = await nexus.loadComposite('test-1');

			const doc = new sut.Document(comp);

			await doc.configure();
			
			const res = await doc.query({}, context);
			
			const args = stubs.execute.getCall(0).args[0];

			expect(args.method)
			.to.equal('read');

			console.log('document.spec.js =>', JSON.stringify(args.query.toJSON(), null, 2));
			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-item-material',
					schema: 'test-item-material',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					path: 'name',
					as: 'item'
				}, {
					series: 'test-category',
					path: 'name',
					as: 'categoryName'
				}, {
					series: 'test-item-material',
					path: 'materialId',
					as: 'sub_0'
				}],
				params: []
			});

			const args2 = stubs.execute.getCall(1).args[0];

			expect(args2.method)
			.to.equal('read');

			expect(args2.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-material',
					schema: 'test-material',
					joins: []
				}],
				fields: [{
					series: 'test-material',
					path: 'name',
					as: 'name'
				}],
				params: [{
					series: 'test-material',
					path: 'id',
					operation: '=',
					settings: {},
					value: 123
				}]
			});

			expect(res)
			.to.deep.equal([{
				item: 'item-1',
				categoryName: 'category-1',
				stuff: [{
					name: 'name-1'
				}]
			}]);
		});
		
		it('should handle a full query', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'personName': 'person-1',
				'categoryName': 'category-1'
			}];

			nexus.configureComposite('test-1', {
				base: 'test-item',
				joins: [
					'>? $test-person',
					'> $test-category'
				],
				fields: {
					'item': '.name',
					'personName': '$test-person.name',
					'categoryName':  '$test-category.name'
				}
			});
			
			const comp = await nexus.loadComposite('test-1');

			const doc = new sut.Document(comp);

			await doc.configure();
			
			const res = await doc.query({
					params: {
						'.name': {
							'~': '%foo%'
						},
						'$test-category.name': 'ok'
					},
					joins: {
						'.name$test-material > $test-item-material > $test-item': 'hello'
					},
					sort: '.name, -$test-category.name,+$test-person.name'
				},
				context
			);
			
			const args = stubs.execute.getCall(0).args[0];

			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-person',
					schema: 'test-person',
					joins: [{
						name: 'test-item',
						optional: true,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-item-material',
					schema: 'test-item-material',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-material',
					schema: 'test-material',
					joins: [{
						name: 'test-item-material',
						optional: false,
						mappings: [{
							from: 'id',
							to: 'materialId'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					as: 'item',
					path: 'name'
				}, {
					series: 'test-person',
					as: 'personName',
					path: 'name'
				}, {
					series: 'test-category',
					as: 'categoryName',
					path: 'name'
				}],
				params: [{
					series: 'test-item',
					path: 'name',
					operation: '~',
					value: '%foo%',
					settings: {}
				}, {
					series: 'test-category',
					path: 'name',
					operation: '=',
					value: 'ok',
					settings: {}
				}, {
					series: 'test-material',
					path: 'name',
					operation: '=',
					value: 'hello',
					settings: {}
				}],
				sorts: [{
					series: 'test-item',
					path: 'name',
					ascending: true
				}, {
					series: 'test-category',
					path: 'name',
					ascending: false
				}, {
					series: 'test-person',
					path: 'name',
					ascending: true
				}]
			});

			expect(res)
			.to.deep.equal([{
				item: 'item-1',
				personName: 'person-1',
				categoryName: 'category-1'
			}]);
		});
	});

	describe('::link', function(){
		it('should fail without defined fields', async function(){
			try {
				// note: i have schema instead of fields
				await nexus.configureComposite('test-composite-ut', {
					base: 'test-family',
					joins: [
						'> $test-category > #test-composite-item'
					],
					schema: {
						'id': '.id',
						'name': '.name',
						'items': ['#test-composite-item']
					}
				});

				expect(true)
				.to.equal(false);
			} catch (ex){
				expect(ex.message)
				.to.equal('composite test-composite-ut: no fields defined');
			}
		});

		it('should fail without defined properties', async function(){
			try {
				// note: i have schema instead of fields
				await nexus.configureComposite('test-composite-ut', {
					base: 'test-family',
					joins: [
						'> $test-category > #test-composite-item'
					],
					fields: {
					}
				});

				expect(true)
				.to.equal(false);
			} catch (ex){
				expect(ex.message)
				.to.equal('composite test-composite-ut: no properties found');
			}
		});

		it('should work with a direct link - without it in the request', async function(){
			await nexus.configureComposite('test-composite-ut', {
				base: 'test-family',
				joins: [
					'> $test-category > #test-composite-item'
				],
				fields: {
					'id': '.id',
					'name': '.name',
					'items': ['#test-composite-item']
				}
			});
			
			const comp = await nexus.loadComposite('test-composite-ut');

			const doc = new sut.Document(comp);

			await doc.configure({});
			await doc.link();
			
			expect(doc.structure.subs.length)
			.to.equal(1);

			const {info, path, composite} = doc.structure.subs[0];

			expect(composite.name)
			.to.equal('test-composite-item');

			expect(path)
			.to.equal('sub_0');

			expect(info.path)
			.to.equal('items');
		});

		it('should work with a hop off an attached model', async function(){
			await nexus.configureComposite('test-composite-ut', {
				base: 'test-family',
				joins: [
					'> $test-category > $test-item > #test-composite-item'
				],
				fields: {
					'id': '.id',
					'name': '.name',
					'items': ['#test-composite-item']
				}
			});

			const comp = await nexus.loadComposite('test-composite-ut');

			const doc = new sut.Document(comp);

			await doc.configure({});
			await doc.link();
			
			const {info, path, composite} = doc.structure.subs[0];

			expect(composite.name)
			.to.equal('test-composite-item');

			expect(path)
			.to.equal('sub_0');

			expect(info.path)
			.to.equal('items');
		});

		it('should correctly define the base fields', async function(){
			const comp = await nexus.loadComposite('test-composite-tag');

			expect(Object.keys(comp.fields).length)
			.to.equal(2);
		});

		it('should work with a jump to the attached schema', async function(){
			await nexus.configureComposite('test-composite-ut', {
				base: 'test-family',
				joins: [
					'> $test-category > #test-composite-tag'
				],
				fields: {
					'id': '.id',
					'name': '.name',
					'tags': ['#test-composite-tag']
				}
			});

			const comp = await nexus.loadComposite('test-composite-ut');

			const doc = new sut.Document(comp);
			
			await doc.configure({});
			await doc.link();
			
			const {info, path, composite} = doc.structure.subs[0];

			expect(composite.name)
			.to.equal('test-composite-tag');

			expect(path)
			.to.equal('sub_0');

			expect(info.path)
			.to.equal('tags');
		});
	});

	describe('::query', function(){
		it('should properly generate a sql request - setting 1', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'categoryName': 'category-1'
			}];

			await nexus.configureComposite('test-comp', {
				base: 'test-item',
				joins: ['> $test-category'],
				fields: {
					'item': '.name',
					'categoryName':  '$test-category.name'
				},
				dynamics: {
					a: {
						field: function(datum){
							return datum.item+'_a';
						}
					}
				}
			});

			const comp = await nexus.loadComposite('test-comp');
			
			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			const res = await doc.query({
				joins: {
					'$test-user.name > .ownerId$test-item': 'shoup'
				}
			}, context);
			
			const args = stubs.execute.getCall(0).args[0];
			
			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}, {
					series: 'test-user',
					schema: 'test-user',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'id',
							to: 'ownerId'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					as: 'item',
					path: 'name'
				}, {
					series: 'test-category',
					as: 'categoryName',
					path: 'name'
				}],
				params: [{
					series: 'test-user',
					path: 'name',
					operation: '=',
					settings: {},
					value: 'shoup'
				}]
			});

			expect(res)
			.to.deep.equal([{
				item: 'item-1',
				categoryName: 'category-1',
				a: {
					field: 'item-1_a'
				}
			}]);
		});

		it('should properly generate a sql request - setting 2', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'categoryName': 'category-1'
			}];

			nexus.configureComposite('test-comp', {
				base: 'test-item',
				joins: [
					'> $test-category'
				],
				fields: {
					'item': '.name',
					'categoryName':  '$test-category.name'
				}
			});
			
			const comp = await nexus.loadComposite('test-comp');
			
			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			const res = await doc.query({
				params: {
					'$test-category.foo': 'bar'
				},
				joins: {
					'$test-category.name': 'foo-bar'
				}
			}, context);
			
			const args = stubs.execute.getCall(0).args[0];

			expect(args.method)
			.to.equal('read');

			expect(args.query.toJSON())
			.to.deep.equal({
				models: [{
					series: 'test-item',
					schema: 'test-item',
					joins: []
				}, {
					series: 'test-category',
					schema: 'test-category',
					joins: [{
						name: 'test-item',
						optional: false,
						mappings: [{
							from: 'itemId',
							to: 'id'
						}]
					}]
				}],
				fields: [{
					series: 'test-item',
					as: 'item',
					path: 'name'
				}, {
					series: 'test-category',
					as: 'categoryName',
					path: 'name'
				}],
				params: [{
					series: 'test-category',
					path: 'foo',
					operation: '=',
					settings: {},
					value: 'bar'
				}, {
					series: 'test-category',
					path: 'name',
					operation: '=',
					settings: {},
					value: 'foo-bar'
				}]
			});

			expect(res)
			.to.deep.equal([{
				item: 'item-1',
				categoryName: 'category-1'
			}]);
		});
	});

	describe('::normalize', function(){
		it('should load decode a object push - 1', async function(){
			nexus.configureComposite('test-comp', {
				base: 'test-item',
				joins: [
					'> $test-category'
				],
				fields: {
					'item': '.name',
					'categoryName':  '$test-category.name'
				}
			});

			const comp = await nexus.loadComposite('test-comp');

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			const instructions = doc.buildNormalizedSchema();
			await doc.normalize(
				{
					item: 'item-1',
					categoryName: 'category-1'
				},
				instructions.getSession(),
				context
			);

			expect(instructions.toJSON())
			.to.deep.equal({
				'test-item': [{
					$ref: 'test-item:1',
					$type: 'create',
					name: 'item-1'
				}],
				'test-category': [{
					$ref: 'test-category:1',
					$type: 'create',
					name: 'category-1',
					itemId: 'test-item:1'
				}]
			});
		});

		it('should load decode a object push - 2', async function(){
			nexus.configureComposite('test-comp', {
				base: 'test-item',
				joins: [
					'> $test-category'
				],
				fields: {
					'id': '.id',
					'item': '.name',
					'categoryId': '$test-category.id',
					'categoryName':  '$test-category.name'
				}
			});

			const comp = await nexus.loadComposite('test-comp');

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			const instructions = doc.buildNormalizedSchema();
			await doc.normalize(
				{
					id: 123,
					item: 'item-1',
					categoryId: 456,
					categoryName: 'category-1'
				},
				instructions.getSession(),
				context
			);

			expect(instructions.toJSON())
			.to.deep.equal({
				'test-item': [{
					$ref: 123,
					$type: 'update',
					id: 123,
					name: 'item-1'
				}],
				'test-category': [{
					$ref: 456,
					$type: 'update',
					id: 456,
					name: 'category-1',
					itemId: 123
				}]
			});
		});
	});

	describe('::push', function(){
		it('should load decode a object push - 1', async function(){
			const items = await nexus.loadCrud('test-item');

			const categories = await nexus.loadCrud('test-category');

			const comp = await nexus.configureComposite('test-comp', {
				base: 'test-item',
				joins: [
					'> $test-category'
				],
				fields: {
					'item': '.name',
					'categoryName':  '$test-category.name'
				}
			});

			stubs.item = sinon.stub(items, 'create')
			.resolves({
				id: 1,
				name: 'item-created'
			});

			stubs.category = sinon.stub(categories, 'create')
			.resolves({
				id: 1,
				name: 'category-created'
			});

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);

			const res = await doc.push(
				{
					item: 'item-1',
					categoryName: 'category-1'
				}, 
				context
			);

			expect(res)
			.to.deep.equal([
				{
					action: 'create',
					model: 'test-item',
					datum: {
						id: 1,
						name: 'item-created'
					}
				},
				{
					action: 'create',
					model: 'test-category',
					datum: {
						id: 1,
						name: 'category-created'
					}
				}
			]);
		});

		it('should load decode a object push - 2', async function(){
			const items = await nexus.loadCrud('test-item');

			const categories = await nexus.loadCrud('test-category');

			const comp = await nexus.configureComposite('test-comp', {
				base: 'test-item',
				joins: [
					'> $test-category'
				],
				fields: {
					'id': '.id',
					'item': '.name',
					'categoryId': '$test-category.id',
					'categoryName':  '$test-category.name'
				}
			});

			stubs.itemRead = sinon.stub(items, 'read')
			.resolves({
				id: 789,
				name: 'item-read'
			});

			stubs.item = sinon.stub(items, 'update')
			.resolves({
				id: 'item-update-1',
				name: 'item-update'
			});

			stubs.categoryRead = sinon.stub(categories, 'read')
			.resolves({
				id: 987,
				name: 'category-read'
			});

			stubs.category = sinon.stub(categories, 'update')
			.resolves({
				id: 1,
				name: 'category-update'
			});

			stubs.deflateSpy = sinon.spy(normalization, 'deflate');

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			const res = await doc.push({
				id: 123,
				item: 'item-1',
				categoryId: 456,
				categoryName: 'category-1'
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-item': [{
					$ref: 123,
					$type: 'update',
					id: 123,
					name: 'item-1'
				}],
				'test-category': [{
					$ref: 456,
					$type: 'update',
					id: 456,
					name: 'category-1',
					itemId: 123
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					action: 'update',
					model: 'test-item',
					datum: {
						id: 'item-update-1',
						name: 'item-update'
					}
				},
				{
					action: 'update',
					model: 'test-category',
					datum: {
						id: 1,
						name: 'category-update'
					}
				}
			]);

			expect(stubs.item.getCall(0).args[0])
			.to.equal(789); // this comes from the read's result

			expect(stubs.category.getCall(0).args[0])
			.to.deep.equal(987);
		});

		it('should work with a required field', async function(){
			const tags = await nexus.loadCrud('test-tag');

			const comp = await nexus.configureComposite('test-comp', {
				base: 'test-tag',
				joins: [],
				fields: {
					'name': '.name',
					'required':  '.required'
				}
			});

			stubs.tagTag = sinon.stub(tags, 'create')
			.resolves({
				id: 1,
				name: 'tag-created'
			});

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			let failed = false;
			try {
				await doc.push(
					{
						name: 'tag-1',
						required: 'ok'
					}, 
					context
				);
			} catch(ex){
				failed = true;
			}

			expect(failed)
			.to.equal(false);
		});

		it('should fail without a required field', async function(){
			const tags = await nexus.loadCrud('test-tag');

			const comp = await nexus.configureComposite('test-comp', {
				base: 'test-tag',
				joins: [],
				fields: {
					'name': '.name',
					'required':  '.required'
				}
			});

			stubs.tagTag = sinon.stub(tags, 'create')
			.resolves({
				id: 1,
				name: 'tag-created'
			});

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			let failed = false;
			try {
				await doc.push(
					{
						name: 'tag-1'
					}, 
					context
				);
			} catch(ex){
				failed = true;
			}

			expect(failed)
			.to.equal(true);
		});
	});

	describe('sub-composites', function(){
		let items = null;
		let families = null;
		let categories = null;

		it('should work with a direct link', async function(){
			items = await nexus.loadCrud('test-item');
			families = await nexus.loadCrud('test-family');
			categories = await nexus.loadCrud('test-category');

			const comp = await nexus.configureComposite('test-composite-ut', {
				base: 'test-family',
				joins: [
					'> $test-category > #test-composite-item'
				],
				fields: {
					'id': '.id',
					'name': '.name',
					'items': ['#test-composite-item']
				}
			});

			stubs.familyRead = sinon.stub(families, 'read')
			.resolves({
				id: 12,
				name: 'family-read'
			});

			stubs.familyCreate = sinon.stub(families, 'update')
			.resolves({
				id: 'family-1',
				name: 'family-updated'
			});

			stubs.itemRead = sinon.stub(items, 'read')
			.resolves({
				id: 34,
				name: 'item-read'
			});

			stubs.itemCreate = sinon.stub(items, 'update');
			stubs.itemCreate.onCall(0).resolves({
				id: 'item-1',
				name: 'item-updated'
			});
			stubs.itemCreate.onCall(1).resolves({
				id: 'item-2',
				name: 'item-updated'
			});

			stubs.categoryRead = sinon.stub(categories, 'read')
			.resolves({
				id: 'cat-1',
				name: 'category-read'
			});

			stubs.categoryUpdate = sinon.stub(categories, 'update')
			.resolves({
				id: 'cat-1',
				name: 'category-update'
			});

			stubs.categoryCreate = sinon.stub(categories, 'create')
			.resolves({
				id: 'cat-2',
				name: 'category-created'
			});

			stubs.deflateSpy = sinon.spy(normalization, 'deflate');

			permissions = {
				admin: true
			};

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);

			const res = await doc.push({
				id: 12,
				name: 'family-1',
				items: [{
					id: 78,
					item: 'item-2',
					categoryName: 'category-2'
				}, {
					id: 34,
					item: 'item-1',
					categoryId: 56, 
					categoryName: 'category-1'
				}]
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-family': [{
					$ref: 12,
					$type: 'update',
					id: 12,
					name: 'family-1'
				}],
				'test-item': [{
					$ref: 78,
					$type: 'update',
					id: 78,
					name: 'item-2'
				}, {
					$ref: 34,
					$type: 'update',
					id: 34,
					name: 'item-1'
				}],
				'test-category': [{
					$ref: 'test-category:1',
					$type: 'create',
					id: undefined,
					name: 'category-2',
					itemId: 78,
					familyId: 12
				}, {
					$ref: 56,
					$type: 'update',
					id: 56,
					name: 'category-1',
					itemId: 34,
					familyId: 12
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					action: 'update',
					model: 'test-family',
					datum: {
						id: 'family-1',
						name: 'family-updated'
					}
				},
				{
					action: 'update',
					model: 'test-item',
					datum: {
						id: 'item-1',
						name: 'item-updated'
					}
				}, {
					action: 'update',
					model: 'test-item',
					datum: {
						id: 'item-2',
						name: 'item-updated'
					}
				}, {
					action: 'create',
					model: 'test-category',
					datum: {
						id: 'cat-2',
						name: 'category-created'
					}
				}, {
					action: 'update',
					model: 'test-category',
					datum: {
						id: 'cat-1',
						name: 'category-update'
					}
				}
			]);

			expect(stubs.itemRead.getCall(0).args[0])
			.to.equal(78);

			expect(stubs.itemRead.getCall(1).args[0])
			.to.equal(34);

			expect(stubs.categoryRead.getCall(0).args[0])
			.to.deep.equal(56);
		});

		let tags = null;

		it('should work with a hop off an attached model', async function(){
			tags = await nexus.loadCrud('test-tag');
			families = await nexus.loadCrud('test-family');
			categories = await nexus.loadCrud('test-category');

			const comp = await nexus.configureComposite('test-composite-ut', {
				base: 'test-family',
				joins: [
					'> $test-category > #test-composite-tag'
				],
				fields: {
					'id': '.id',
					'name': '.name',
					'categoryName': '$test-category.name',
					'tags': ['#test-composite-tag']
				}
			});

			stubs.familyRead = sinon.stub(families, 'read')
			.resolves({
				id: 12,
				name: 'family-read'
			});

			stubs.familyCreate = sinon.stub(families, 'update')
			.resolves({
				id: 'family-1',
				name: 'family-updated'
			});

			stubs.categoryCreate = sinon.stub(categories, 'create')
			.resolves({
				id: 'cat-1',
				name: 'category-created'
			});

			stubs.tagCreate = sinon.stub(tags, 'create');
			stubs.tagCreate.onCall(0).resolves({
				id: 'tag-1',
				name: 'tag-created'
			});
			stubs.tagCreate.onCall(1).resolves({
				id: 'tag-2',
				name: 'tag-created'
			});

			stubs.deflateSpy = sinon.spy(normalization, 'deflate');

			permissions = {
				admin: true
			};

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);

			const res = await doc.push({
				id: 12,
				name: 'family-name-1',
				categoryName: 'category-name-1',
				tags: [{
					name: 'tag-name-1',
					required: 'ok'
				}, {
					name: 'tag-name-2',
					required: 'yeah'
				}]
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-family': [{
					$ref: 12,
					$type: 'update',
					id: 12,
					name: 'family-name-1'
				}],
				'test-category': [{
					$ref: 'test-category:1',
					$type: 'create',
					name: 'category-name-1',
					familyId: 12
				}],
				'test-tag': [{
					$ref: 'test-tag:1',
					$type: 'create',
					name: 'tag-name-1',
					categoryId: 'test-category:1',
					required: 'ok'
				},{
					$ref: 'test-tag:2',
					$type: 'create',
					name: 'tag-name-2',
					categoryId: 'test-category:1',
					required: 'yeah'
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					model: 'test-family',
					action: 'update',
					datum: {
						id: 'family-1',
						name: 'family-updated'
					}
				}, {
					model: 'test-category',
					action: 'create',
					datum: {
						id: 'cat-1',
						name: 'category-created'
					}
				}, {
					model: 'test-tag',
					action: 'create',
					datum: {
						id: 'tag-1',
						name: 'tag-created'
					}
				}, {
					model: 'test-tag',
					action: 'create',
					datum: {
						id: 'tag-2',
						name: 'tag-created'
					}
				}
			]);

			expect(stubs.familyRead.getCall(0).args[0])
			.to.deep.equal(12);
		});

		it('should work with a jump to the attached schema', async function(){
			tags = await nexus.loadCrud('test-tag');
			families = await nexus.loadCrud('test-family');
			categories = await nexus.loadCrud('test-category');

			const comp = await nexus.configureComposite('test-composite-ut', {
				base: 'test-family',
				joins: [
					'> $test-category > #test-composite-tag'
				],
				fields: {
					'id': '.id',
					'name': '.name',
					'tags': ['#test-composite-tag']
				}
			});

			stubs.familyRead = sinon.stub(families, 'read')
			.resolves({
				id: 12,
				name: 'family-read'
			});

			stubs.familyCreate = sinon.stub(families, 'update')
			.resolves({
				id: 'family-1',
				name: 'family-updated'
			});

			stubs.categoryCreate = sinon.stub(categories, 'create')
			.resolves({
				id: 'cat-1',
				name: 'category-created'
			});

			stubs.tagCreate = sinon.stub(tags, 'create');
			stubs.tagCreate.onCall(0).resolves({
				id: 'tag-1',
				name: 'tag-created',
				required: 'req-1'
			});
			stubs.tagCreate.onCall(1).resolves({
				id: 'tag-2',
				name: 'tag-created',
				required: 'req-2'
			});

			stubs.deflateSpy = sinon.spy(normalization, 'deflate');

			permissions = {
				admin: true
			};

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);

			const res = await doc.push({
				id: 12,
				name: 'family-name-1',
				tags: [{
					name: 'tag-name-1',
					required: 'req-1'
				}, {
					name: 'tag-name-2',
					required: 'req-2'
				}]
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-family': [{
					$ref: 12,
					$type: 'update',
					id: 12,
					name: 'family-name-1'
				}],
				'test-category': [{
					$ref: 'test-category:1',
					$type: 'create',
					familyId: 12
				}],
				'test-tag': [{
					$ref: 'test-tag:1',
					$type: 'create',
					name: 'tag-name-1',
					categoryId: 'test-category:1',
					required: 'req-1'
				},{
					$ref: 'test-tag:2',
					$type: 'create',
					name: 'tag-name-2',
					categoryId: 'test-category:1',
					required: 'req-2'
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					model: 'test-family',
					action: 'update',
					datum: {
						id: 'family-1',
						name: 'family-updated'
					}
				}, {
					model: 'test-category',
					action: 'create',
					datum: {
						id: 'cat-1',
						name: 'category-created'
					}
				}, {
					model: 'test-tag',
					action: 'create',
					datum: {
						id: 'tag-1',
						name: 'tag-created',
						required: 'req-1'
					}
				}, {
					model: 'test-tag',
					action: 'create',
					datum: {
						id: 'tag-2',
						name: 'tag-created',
						required: 'req-2'
					}
				}
			]);

			expect(stubs.familyRead.getCall(0).args[0])
			.to.deep.equal(12);
		});

		it('should fail if the attached schema fails', async function(){
			tags = await nexus.loadCrud('test-tag');
			families = await nexus.loadCrud('test-family');
			categories = await nexus.loadCrud('test-category');

			const comp = await nexus.configureComposite('test-composite-ut', {
				base: 'test-family',
				joins: [
					'> $test-category > #test-composite-tag'
				],
				fields: {
					'id': '.id',
					'name': '.name',
					'tags': ['#test-composite-tag']
				}
			});

			stubs.familyRead = sinon.stub(families, 'read')
			.resolves({
				id: 12,
				name: 'family-read'
			});

			stubs.familyCreate = sinon.stub(families, 'update')
			.resolves({
				id: 'family-1',
				name: 'family-updated'
			});

			stubs.categoryCreate = sinon.stub(categories, 'create')
			.resolves({
				id: 'cat-1',
				name: 'category-created'
			});

			stubs.tagCreate = sinon.stub(tags, 'create');
			stubs.tagCreate.onCall(0).resolves({
				id: 'tag-1',
				name: 'tag-created',
				required: 'req-1'
			});
			stubs.tagCreate.onCall(1).resolves({
				id: 'tag-2',
				name: 'tag-created',
				required: 'req-2'
			});

			stubs.deflateSpy = sinon.spy(normalization, 'deflate');

			permissions = {
				admin: true
			};

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);

			let failed = false;

			try {
				await doc.push({
					id: 12,
					name: 'family-name-1',
					tags: [{
						name: 'tag-name-1',
						required: 'req-1'
					}, {
						name: 'tag-name-2'
					}]
				}, context);
			} catch(ex) {
				failed = true;
			}

			expect(failed)
			.to.equal(true);
		});
	});

	//------------ pivot table 
	describe('pivot table', function(){
		let items = null;
		let itemMaterials = null;
		let materials = null;
		let comp = null;

		beforeEach(async function(){
			await nexus.configureComposite('test-material', {
				base: 'test-material',
				joins: [],
				fields: {
					'id': '.id',
					'name': '.name'
				}
			});
			await nexus.configureDocument('test-material', connector);

			await nexus.configureComposite('test-composite-material', {
				base: 'test-item-material',
				extends: 'test-material',
				joins: [],
				fields: {
					'pivot': '.id'
				}
			});
			await nexus.configureDocument('test-composite-material', connector);

			await nexus.configureComposite('test-composite-material-2', {
				base: 'test-item-material',
				extends: 'test-composite-material',
				joins: [],
				fields: {
					'mask': '.mask'
				}
			});
			await nexus.configureDocument('test-composite-material-2', connector);

			await nexus.configureComposite('test-composite-ti', {
				base: 'test-item',
				joins: [
					'> #test-composite-material-2'
				],
				fields: {
					'id': '.id',
					'name': '.name',
					'materials': ['#test-composite-material-2']
				}
			});
			await nexus.configureDocument('test-composite-ti', connector);
		});

		it('should work when creating brand new', async function(){
			items = await nexus.loadCrud('test-item');
			itemMaterials = await nexus.loadCrud('test-item-material');
			materials = await nexus.loadCrud('test-material');

			comp = await nexus.loadComposite('test-composite-ti');
			
			stubs.itemCreate = sinon.stub(items, 'create')
			.resolves({
				id: 'item-1',
				name: 'item-created'
			});

			stubs.materialCreate = sinon.stub(materials, 'create')
			.resolves({
				id: 'material-1',
				name: 'material-created'
			});

			stubs.imCreate = sinon.stub(itemMaterials, 'create')
			.resolves({
				id: 'im-1',
				itemId: 'item-1-1',
				materialId: 'material-1-1'
			});

			stubs.deflateSpy = sinon.spy(normalization, 'deflate');

			permissions = {
				admin: true
			};

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			
			const res = await doc.push({
				name: 'item-name-1',
				materials: [{
					name: 'material-name-1'
				}]
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-item': [{
					$ref: 'test-item:1',
					$type: 'create',
					id: undefined,
					name: 'item-name-1'
				}],
				'test-material': [{
					$ref: 'test-material:1',
					$type: 'create',
					id: undefined,
					name: 'material-name-1'
				}],
				'test-item-material': [{
					$ref: 'test-item-material:1',
					$type: 'create',
					id: undefined,
					itemId: 'test-item:1',
					materialId: 'test-material:1',
					mask: undefined
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					model: 'test-item',
					action: 'create',
					datum: {
						id: 'item-1',
						name: 'item-created'
					}
				}, {
					model: 'test-material',
					action: 'create',
					datum: {
						id: 'material-1',
						name: 'material-created'
					}
				}, {
					model: 'test-item-material',
					action: 'create',
					datum: {
						id: 'im-1',
						itemId: 'item-1-1',
						materialId: 'material-1-1'
					}
				}
			]);

			expect(stubs.itemCreate.getCall(0).args[0])
			.to.deep.equal({
				id: undefined,
				name: 'item-name-1'
			});

			expect(stubs.materialCreate.getCall(0).args[0])
			.to.deep.equal({
				id: undefined,
				name: 'material-name-1'
			});

			expect(stubs.imCreate.getCall(0).args[0])
			.to.deep.equal({
				id: undefined,
				itemId: 'item-1',
				materialId: 'material-1',
				mask: undefined
			});
		});

		it('should work when updating all things', async function(){
			items = await nexus.loadCrud('test-item');
			itemMaterials = await nexus.loadCrud('test-item-material');
			materials = await nexus.loadCrud('test-material');

			comp = await nexus.loadComposite('test-composite-ti');

			// updates require us to stub read
			stubs.itemRead = sinon.stub(items, 'read')
			.resolves({
				id: 'item-1',
				name: 'item-updated'
			});

			stubs.itemCreate = sinon.stub(items, 'update')
			.resolves({
				id: 'item-1',
				name: 'item-updated'
			});

			stubs.materialRead = sinon.stub(materials, 'read')
			.resolves({
				id: 'material-1',
				name: 'material-updated'
			});

			stubs.materialCreate = sinon.stub(materials, 'update')
			.resolves({
				id: 'material-1',
				name: 'material-updated'
			});

			stubs.imRead = sinon.stub(itemMaterials, 'read')
			.resolves({
				id: 'im-1',
				itemId: 'item-1-1',
				materialId: 'material-1-1'
			});

			stubs.imCreate = sinon.stub(itemMaterials, 'update')
			.resolves({
				id: 'im-1',
				itemId: 'item-1-1',
				materialId: 'material-1-1'
			});

			stubs.deflateSpy = sinon.spy(normalization, 'deflate');

			permissions = {
				admin: true
			};

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);

			const res = await doc.push({
				id: 'item-id-1',
				name: 'item-name-10',
				materials: [{
					pivot: 'join-1',
					mask: 'it-is-a-cowl',
					id: 'material-1',
					name: 'material-name-10'
				}]
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-item': [{
					$ref: 'item-id-1',
					$type: 'update',
					id: 'item-id-1',
					name: 'item-name-10'
				}],
				'test-material': [{
					$ref: 'material-1',
					$type: 'update',
					id: 'material-1',
					name: 'material-name-10'
				}],
				'test-item-material': [{
					$ref: 'join-1',
					$type: 'update',
					id: 'join-1',
					itemId: 'item-id-1',
					materialId: 'material-1',
					mask: 'it-is-a-cowl'
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					model: 'test-item',
					action: 'update',
					datum: {
						id: 'item-1',
						name: 'item-updated'
					}
				}, {
					model: 'test-material',
					action: 'update',
					datum: {
						id: 'material-1',
						name: 'material-updated'
					}
				}, {
					model: 'test-item-material',
					action: 'update',
					datum: {
						id: 'im-1',
						itemId: 'item-1-1',
						materialId: 'material-1-1'
					}
				}
			]);

			expect(stubs.itemCreate.getCall(0).args[1])
			.to.deep.equal({
				id: 'item-id-1',
				name: 'item-name-10'
			});

			expect(stubs.materialCreate.getCall(0).args[1])
			.to.deep.equal({
				id: 'material-1',
				name: 'material-name-10'
			});

			expect(stubs.imCreate.getCall(0).args[1])
			.to.deep.equal({
				id: 'join-1',
				itemId: 'item-1',
				materialId: 'material-1',
				mask: 'it-is-a-cowl'
			});
		});
	});

	describe('change type - versioning', function(){

		let items = null;
		let itemMaterials = null;
		let materials = null;
		let doc = null;

		beforeEach(async function(){
			items = await nexus.loadCrud('test-item');
			itemMaterials = await nexus.loadCrud('test-item-material');
			materials = await nexus.loadCrud('test-material');

			// updates require us to stub read
			stubs.itemRead = sinon.stub(items, 'read')
			.resolves({
				id: 'item-1',
				name: 'item-updated'
			});

			stubs.itemCreate = sinon.stub(items, 'update')
			.resolves({
				id: 'item-1',
				name: 'item-updated'
			});

			stubs.materialRead = sinon.stub(materials, 'read')
			.resolves({
				id: 'material-1',
				name: 'material-updated'
			});

			stubs.materialCreate = sinon.stub(materials, 'update')
			.resolves({
				id: 'material-1',
				name: 'material-updated'
			});

			stubs.imRead = sinon.stub(itemMaterials, 'read')
			.resolves({
				id: 'im-1',
				itemId: 'item-1-1',
				materialId: 'material-1-1'
			});

			stubs.imCreate = sinon.stub(itemMaterials, 'update')
			.resolves({
				id: 'im-1',
				itemId: 'item-1-1',
				materialId: 'material-1-1'
			});
		});

		describe('assign getChangeType directly', async function(){
			let changeCb = null;

			beforeEach(async function(){
				await nexus.configureComposite('test-material', {
					base: 'test-material',
					joins: [],
					fields: {
						'id': '.id',
						'name': '.name'
					}
				});
				await nexus.configureDocument('test-material', connector);

				await nexus.configureComposite('test-composite-material', {
					base: 'test-item-material',
					extends: 'test-material',
					joins: [],
					fields: {
						'pivot': '.id',
						'tag': '.tag',
						'mask': '.mask',
						'note': '.note'
					}
				});
				await nexus.configureDocument('test-composite-material', connector);

				await nexus.configureComposite('test-composite-ti2', {
					base: 'test-item',
					joins: [
						'> #test-composite-material'
					],
					fields: {
						'id': '.id',
						'name': '.name',
						'materials': ['#test-composite-material']
					},
					onChange: async function(type, instructions){
						return changeCb(type, instructions);
					}
				});
				doc = await nexus.configureDocument('test-composite-ti2', connector);
			});

			it('should work with a major type change', async function(){
				changeCb = function(type){
					expect(type)
					.to.equal(changeTypes.major);
				};

				await doc.push({
					id: 'item-id-1',
					//name: 'item-name-10',
					materials: [{
						id: 'material-1',
						pivot: 'join-1',
						tag: 'material-name-10'
					}]
				}, context);
			});

			it('should work with a minor type change', async function(){
				changeCb = function(type){
					expect(type)
					.to.equal(changeTypes.minor);
				};

				await doc.push({
					id: 'item-id-1',
					//name: 'item-name-10',
					materials: [{
						id: 'material-1',
						pivot: 'join-1',
						mask: 'material-name-10'
					}]
				}, context);
			});

			it('should work with a none type change', async function(){
				changeCb = function(type){
					expect(type)
					.to.equal(changeTypes.none);
				};

				await doc.push({
					id: 'item-id-1',
					//name: 'item-name-10',
					materials: [{
						id: 'material-1',
						pivot: 'join-1',
						note: 'material-name-10'
					}]
				}, context);
			});

			it('should allow major to override with minor first', async function(){
				changeCb = function(type){
					expect(type)
					.to.equal(changeTypes.major);
				};

				await doc.push({
					id: 'item-id-1',
					name: 'item-name-10',
					materials: [{
						pivot: 'join-1',
						id: 'material-1',
						tag: 'material-name-10'
					}, {
						pivot: 'join-2',
						id: 'material-2',
						tag: 'material-name-20'
					}]
				}, context);
			});

			it('should allow major to override with major first', async function(){
				changeCb = function(type){
					expect(type)
					.to.equal(changeTypes.major);
				};

				await doc.push({
					id: 'item-id-1',
					name: 'item-name-10',
					materials: [{
						pivot: 'join-1',
						id: 'material-1',
						mask: 'material-name-20'
					}, {
						pivot: 'join-2',
						id: 'material-2',
						mask: 'material-name-20'
					}]
				}, context);
			});

			it('should allow major to override with major in the middle', async function(){
				changeCb = function(type){
					expect(type)
					.to.equal(changeTypes.major);
				};

				await doc.push({
					id: 'item-id-1',
					materials: [{
						pivot: 'join-1',
						id: 'material-1',
						mask: 'material-name-10'
					}, {
						pivot: 'join-2',
						id: 'material-2',
						tag: 'material-name-20'
					}, {
						pivot: 'join-3',
						id: 'material-3',
						mask: 'material-name-30'
					}]
				}, context);
			});
		});

		describe('assign getChangeType via extends', async function(){
			let changeCb = null;

			beforeEach(async function(){
				await nexus.configureComposite('test-material', {
					base: 'test-material',
					joins: [],
					fields: {
						'id': '.id',
						'name': '.name'
					}
				});
				await nexus.configureDocument('test-material', connector);

				await nexus.configureComposite('test-item', {
					base: 'test-item',
					joins: [],
					fields: {
						'id': '.id',
						'name': '.name'
					}
				});
				await nexus.configureDocument('test-item', connector);

				await nexus.configureComposite('test-mappings', {
					base: 'test-item-material',
					joins: [],
					fields: {
						'itemId': '.itemId',
						'materialId': '.materialId'
					}
				});
				await nexus.configureDocument('test-mappings', connector);

				await nexus.configureComposite('test-composite-material', {
					base: 'test-item-material',
					extends: 'test-material',
					joins: [],
					fields: {
						'pivot': '.id'
					}
				});
				await nexus.configureDocument('test-composite-material', connector);

				await nexus.configureComposite('test-composite-ti3', {
					base: 'test-item',
					joins: [
						'> #test-composite-material'
					],
					fields: {
						'id': '.id',
						'name': '.name',
						'materials': ['#test-composite-material']
					},
					onChange: async function(type, instructions){
						return changeCb(type, instructions);
					}
				});

				doc = await nexus.configureDocument('test-composite-ti3', connector);
			});
		});
	});

	describe('multi tiered', function(){
		let doc = null;

		const changeTypes = require('../schema/structure.js').config.get('changeTypes');

		beforeEach(async function(){
			await nexus.configureComposite('test-material', {
				base: 'test-material',
				joins: [],
				fields: {
					'id': '.id',
					'name': '.name'
				}
			});
			await nexus.configureDocument('test-material', connector);

			await nexus.configureComposite('test-item', {
				base: 'test-item',
				joins: [],
				fields: {
					'id': '.id',
					'name': '.name'
				}
			});
			await nexus.configureDocument('test-item', connector);

			await nexus.configureComposite('test-mappings', {
				base: 'test-item-material',
				joins: [],
				fields: {
					'itemId': '.itemId',
					'materialId': '.materialId'
				}
			});
			await nexus.configureDocument('test-mappings', connector);

			await nexus.configureComposite('test-composite-material', {
				base: 'test-item-material',
				extends: 'test-material',
				joins: [],
				fields: {
					'pivot': '.id'
				}
			});
			await nexus.configureDocument('test-composite-material', connector);

			stubs.onChange = sinon.stub()
			.callsFake(function(type, series){
				const datum = series.getSeries('test-item')[0];

				if (type === changeTypes.major){
					datum.setField('name', datum.getField('name')+'.1');
				} else {
					datum.setField('name', datum.getField('name')+'.2');
				}
			});
			await nexus.configureComposite('test-composite-ti3', {
				base: 'test-item',
				joins: [
					'> #test-composite-material'
				],
				fields: {
					'id': '.id',
					'name': '.name',
					'materials': ['#test-composite-material']
				},
				onChange: stubs.onChange
			});
			await nexus.configureDocument('test-composite-ti3', connector);

			await nexus.configureComposite('test-ownership', {
				base: 'test-user',
				joins: [
					'.id > .ownerId#test-composite-ti3'
				],
				fields: {
					'id': '.id',
					'name': '.name',
					'items': ['#test-composite-ti3']
				}
			});

			// this schema makes no sense in practicality...
			await nexus.configureComposite('test-god', {
				base: 'test-user',
				joins: [
					'.id > .creatorId#test-item',
					'.id > .creatorId#test-material',
					'.id > .creatorId#test-mappings'
				],
				fields: {
					'id': '.id',
					'items': ['#test-item'],
					'materials': ['#test-material'],
					'mappings': ['#test-mappings']
				}
			});
		});

		it('should only call once', async function(){
			doc = await nexus.configureDocument('test-ownership', connector);

			const users = await nexus.loadCrud('test-user');
			const items = await nexus.loadCrud('test-item');
			const itemMaterials = await nexus.loadCrud('test-item-material');
			const materials = await nexus.loadCrud('test-material');

			stubs.userRead = sinon.stub(users, 'read')
			.resolves({
				id: 'user-1',
				name: 'user-updated'
			});

			stubs.userCreate = sinon.stub(users, 'update')
			.resolves({
				id: 'user-1',
				name: 'user-updated'
			});

			stubs.itemRead = sinon.stub(items, 'read')
			.resolves({
				id: 'item-1',
				name: 'item-updated'
			});

			stubs.itemChange = sinon.stub(items, 'getChangeType')
			.resolves(changeTypes.minor);

			stubs.itemCreate = sinon.stub(items, 'update')
			.resolves({
				id: 'item-1',
				name: 'item-updated'
			});

			stubs.materialRead = sinon.stub(materials, 'read')
			.resolves({
				id: 'material-1',
				name: 'material-updated'
			});

			stubs.materialChange = sinon.stub(materials, 'getChangeType')
			.resolves(changeTypes.minor);

			stubs.materialCreate = sinon.stub(materials, 'update')
			.resolves({
				id: 'material-1',
				name: 'material-updated'
			});

			stubs.imRead = sinon.stub(itemMaterials, 'read')
			.resolves({
				id: 'im-1',
				itemId: 'item-1-1',
				materialId: 'material-1-1'
			});

			stubs.imChange = sinon.stub(itemMaterials, 'getChangeType')
			.resolves(changeTypes.major);

			stubs.imCreate = sinon.stub(itemMaterials, 'update')
			.resolves({
				id: 'im-1',
				itemId: 'item-1-1',
				materialId: 'material-1-1'
			});

			stubs.deflateSpy = sinon.spy(normalization, 'deflate');

			await doc.push({
				id: 'user-id-1',
				name: 'user-name-10',
				items: [{
					id: 'item-id-1',
					name: 'item-name-10',
					materials: [{
						pivot: 'join-1',
						id: 'material-1',
						name: 'material-name-10'
					}]
				}, {
					id: 'item-id-2',
					materials: [{
						pivot: 'join-2',
						id: 'material-2',
						name: 'material-name-20'
					}]
				}, {
					id: 'item-id-3',
					name: 'item-name-30',
					materials: [{
						pivot: 'join-3',
						id: 'material-3',
						name: 'material-name-30'
					}]
				}]
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-user': [{
					'$ref': 'user-id-1',
					'$type': 'update',
					'id': 'user-id-1',
					'name': 'user-name-10'
				}],
				'test-item': [{
					'$ref': 'item-id-1',
					'$type': 'update',
					'id': 'item-id-1',
					'name': 'item-name-10.1',
					'ownerId': 'user-id-1'
				},
				{
					'$ref': 'item-id-2',
					'$type': 'update',
					'id': 'item-id-2',
					'name': 'undefined.1',
					'ownerId': 'user-id-1'
				},
				{
					'$ref': 'item-id-3',
					'$type': 'update',
					'id': 'item-id-3',
					'name': 'item-name-30.1',
					'ownerId': 'user-id-1'
				}],
				'test-material': [{
					'$ref': 'material-1',
					'$type': 'update',
					'id': 'material-1',
					'name': 'material-name-10'
				},
				{
					'$ref': 'material-2',
					'$type': 'update',
					'id': 'material-2',
					'name': 'material-name-20'
				},
				{
					'$ref': 'material-3',
					'$type': 'update',
					'id': 'material-3',
					'name': 'material-name-30'
				}],
				'test-item-material': [{
					'$ref': 'join-1',
					'$type': 'update',
					'id': 'join-1',
					'materialId': 'material-1',
					'itemId': 'item-id-1'
				},
				{
					'$ref': 'join-2',
					'$type': 'update',
					'id': 'join-2',
					'materialId': 'material-2',
					'itemId': 'item-id-2'
				},
				{
					'$ref': 'join-3',
					'$type': 'update',
					'id': 'join-3',
					'materialId': 'material-3',
					'itemId': 'item-id-3'
				}]
			});

			let session = null;

			//-------------
			expect(stubs.onChange.getCall(0).args[0])
			.to.equal(changeTypes.major);

			session = stubs.onChange.getCall(0).args[1];
			
			expect(session.getSeries('test-item').length)
			.to.equal(1);

			//-------------
			expect(stubs.onChange.getCall(1).args[0])
			.to.equal(changeTypes.major);

			session = stubs.onChange.getCall(1).args[1];

			expect(session.getSeries('test-item').length)
			.to.equal(1);

			//-------------
			expect(stubs.onChange.getCall(2).args[0])
			.to.equal(changeTypes.major);

			session = stubs.onChange.getCall(2).args[1];
			expect(session.getSeries('test-item').length)
			.to.equal(1);
		});

		it('should complete parallel processing', async function(){
			doc = await nexus.configureDocument('test-god', connector);

			const users = await nexus.loadCrud('test-user');
			const items = await nexus.loadCrud('test-item');
			const itemMaterials = await nexus.loadCrud('test-item-material');
			const materials = await nexus.loadCrud('test-material');

			stubs.userRead = sinon.stub(users, 'read')
			.resolves({
				id: 'user-1',
				name: 'user-updated'
			});

			stubs.userCreate = sinon.stub(users, 'update')
			.resolves({
				id: 'user-1',
				name: 'user-updated'
			});

			stubs.itemRead = sinon.stub(items, 'read')
			.resolves({
				id: 'item-1',
				name: 'item-updated'
			});

			stubs.itemCreate = sinon.stub(items, 'update')
			.resolves({
				id: 'item-1',
				name: 'item-updated'
			});

			stubs.materialRead = sinon.stub(materials, 'read')
			.resolves({
				id: 'material-1',
				name: 'material-updated'
			});

			stubs.materialCreate = sinon.stub(materials, 'update')
			.resolves({
				id: 'material-1',
				name: 'material-updated'
			});

			stubs.imRead = sinon.stub(itemMaterials, 'read')
			.resolves({
				id: 'im-1',
				itemId: 'item-1-1',
				materialId: 'material-1-1'
			});

			stubs.imCreate = sinon.stub(itemMaterials, 'create')
			.resolves({
				id: 'im-1',
				itemId: 'item-1-1',
				materialId: 'material-1-1'
			});

			stubs.deflateSpy = sinon.spy(normalization, 'deflate');

			await doc.push({
				id: 'user-id',
				items: [{
					id: '$item-id-1',
					name: 'item-name-10'
				}, {
					id: '$item-id-2',
					name: 'item-name-20'
				}, {
					id: '$item-id-3',
					name: 'item-name-30'
				}], 
				materials: [{
					id: '$material-id-1',
					name: 'material-name-10'
				}, {
					id: '$material-id-2',
					name: 'material-name-20'
				}, {
					id: '$material-id-3',
					name: 'material-name-30'
				}],
				mappings: [{
					itemId: '$item-id-1',
					materialId: '$material-id-1'
				}, {
					itemId: '$item-id-2',
					materialId: '$material-id-2'
				}, {
					itemId: '$item-id-2',
					materialId: '$material-id-3'
				}, {
					itemId: '$item-id-3',
					materialId: '$material-id-3'
				}]
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-user': [{
					'$ref': 'user-id',
					'$type': 'update',
					'id': 'user-id'
				}],
				'test-item': [{
					'$ref': '$item-id-1',
					'$type': 'update',
					'id': '$item-id-1',
					'name': 'item-name-10',
					'creatorId': 'user-id'
				},
				{
					'$ref': '$item-id-2',
					'$type': 'update',
					'id': '$item-id-2',
					'name': 'item-name-20',
					'creatorId': 'user-id'
				},
				{
					'$ref': '$item-id-3',
					'$type': 'update',
					'id': '$item-id-3',
					'name': 'item-name-30',
					'creatorId': 'user-id'
				}],
				'test-material': [{
					'$ref': '$material-id-1',
					'$type': 'update',
					'id': '$material-id-1',
					'name': 'material-name-10',
					'creatorId': 'user-id'
				},
				{
					'$ref': '$material-id-2',
					'$type': 'update',
					'id': '$material-id-2',
					'name': 'material-name-20',
					'creatorId': 'user-id'
				},
				{
					'$ref': '$material-id-3',
					'$type': 'update',
					'id': '$material-id-3',
					'name': 'material-name-30',
					'creatorId': 'user-id'
				}],
				'test-item-material': [{
					'$ref': 'test-item-material:1',
					'$type': 'create',
					'materialId': '$material-id-1',
					'itemId': '$item-id-1',
					'creatorId': 'user-id'
				},
				{
					'$ref': 'test-item-material:2',
					'$type': 'create',
					'materialId': '$material-id-2',
					'itemId': '$item-id-2',
					'creatorId': 'user-id'
				},
				{
					'$ref': 'test-item-material:3',
					'$type': 'create',
					'materialId': '$material-id-3',
					'itemId': '$item-id-2',
					'creatorId': 'user-id'
				},
				{
					'$ref': 'test-item-material:4',
					'$type': 'create',
					'materialId': '$material-id-3',
					'itemId': '$item-id-3',
					'creatorId': 'user-id'
				}]
			});
		});
	});
});
