
const {expect} = require('chai');
const sinon = require('sinon');

const {Nexus, config} = require('../env/nexus.js');
const {Context} = require('../server/context.js');
const normalized = require('../schema/normalized.js');
	
describe('src/services/document.js', function(){
	const sut = require('./document.js');

	let nexus = null;
	let stubs = null;
	let context = null;
	
	let connector = null;
	let permissions = null;
	let connectorExecute = null;

	beforeEach(function(){
		permissions = {};

		context = new Context({method: 'get'});
		context.hasPermission = (perm) => !!permissions[perm];

		stubs = {
			execute: sinon.stub()
				.callsFake(async function(){
					return connectorExecute;
				})
		};

		connector = {
			execute: stubs.execute
		};

		config.set('timeout', 500);

		nexus = new Nexus();
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
			fields: {
				id: {
					read: true,
					key: true
				},
				name: true,
				title: true,
				json: {
					read: true,
					type: 'json'
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
			fields: {
				id: {
					read: true,
					key: true
				},
				name: true,
				title: true,
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
				mask: {
					read: true,
					write: true,
					update: true
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
			fields: {
				id: true,
				name: true,
				json: {
					read: true,
					type: 'json'
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
			fields: {
				id: {
					read: true,
					key: true
				},
				name: true,
				json: {
					read: 'admin',
					type: 'json'
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
			fields: {
				id: {
					read: true,
					key: true
				},
				name: true,
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
			key: 'id',
			fields: {
				'id': '.id',
				'item': '.name',
				'categoryId': '> $test-category.id',
				'categoryName':  '> $test-category.name'
			}
		});

		await nexus.configureDocument('test-composite-item', connector);

		await nexus.configureComposite('test-composite-tag', {
			base: 'test-tag',
			key: 'id',
			fields: {
				'name': '.name'
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
				key: 'id',
				fields: {
					'item': '.name',
					'personName': '>? $test-person.name',
					'categoryName':  '> $test-category.name'
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
					operation: {
						value: 1
					}
				}]
			});

			expect(res)
			.to.deep.equal({
				item: 'item-1',
				personName: 'person-1',
				categoryName: 'category-1'
			});
		});

		it('should properly inflate a data response, without security', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'personInfo': '{"foo":"bar"}',
				'category': '{"hello":"world"}'
			}];

			nexus.configureComposite('test-1', {
				base: 'test-item',
				key: 'id',
				fields: {
					'item': '.name',
					'personInfo': '> $test-person.json',
					'categoryInfo':  '> $test-category.json'
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
					operation: {
						value: 1
					}
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
				key: 'id',
				fields: {
					'item': '.name',
					'personInfo': '> $test-person.json',
					'categoryInfo':  '> $test-category.json'
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
					operation: {
						value: 1
					}
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
				key: 'id',
				fields: {
					'item': '.name',
					'personName': '> $test-person.name',
					'ownerName': '.ownerId > $owner:test-user.name',
					'creatorName': '.creatorId > $creator:test-user.name'
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
					operation: {
						value: 1
					}
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

	describe('::link', function(){
		it('should fail without defined properties', async function(){
			await nexus.configureComposite('test-composite-ut', {
				key: 'id',
				base: 'test-family',
				schema: {
					'id': '.id',
					'name': '.name',
					'items': ['> $test-category > #test-composite-item']
				}
			});

			const comp = await nexus.loadComposite('test-composite-ut');

			const doc = new sut.Document(comp);
			await doc.configure({});

			try {
				await doc.link();

				expect(true)
				.to.equal(false);
			} catch (ex){
				expect(ex.message)
				.to.equal('No properties found');
			}
		});

		it('should work with a direct link - without it in the request', async function(){
			await nexus.configureComposite('test-composite-ut', {
				key: 'id',
				base: 'test-family',
				fields: {
					'id': '.id',
					'name': '.name',
					'items': ['> $test-category > #test-composite-item']
				}
			});
			
			const comp = await nexus.loadComposite('test-composite-ut');

			const doc = new sut.Document(comp);

			await doc.configure({});
			await doc.link();
			
			expect(doc.subs.length)
			.to.equal(1);

			const join = doc.subs[0].joins[0];
			expect(join.path)
			.to.equal('.familyId$test-category.itemId>.id$test-item');

			expect(join.datumPath)
			.to.equal('id');
		});

		it('should work with a hop off an attached model', async function(){
			await nexus.configureComposite('test-composite-ut', {
				base: 'test-family',
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name',
					'categoryName': '> $test-category.name',
					'tags': ['> $test-category > #test-composite-tag']
				}
			});

			const comp = await nexus.loadComposite('test-composite-ut');

			const doc = new sut.Document(comp);

			await doc.configure({});
			await doc.link();
			
			const join = doc.subs[0].joins[0];
			expect(join.path)
			.to.equal('.categoryId$test-tag');

			expect(join.datumPath)
			.to.equal('sub_0');
		});

		it('should work with a jump to the attached schema', async function(){
			await nexus.configureComposite('test-composite-ut', {
				base: 'test-family',
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name',
					'tags': ['> $test-category > #test-composite-tag']
				}
			});

			const comp = await nexus.loadComposite('test-composite-ut');

			const doc = new sut.Document(comp);
			
			await doc.configure({});
			await doc.link();
			
			const join = doc.subs[0].joins[0];
			expect(join.path)
			.to.equal('.familyId$test-category.id>.categoryId$test-tag');

			expect(join.datumPath)
			.to.equal('id');
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
				key: 'id',
				fields: {
					'item': '.name',
					'categoryName':  '> $test-category.name'
				}
			});

			const comp = await nexus.loadComposite('test-comp');
			
			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			const res = await doc.query({
				joins: {
					'$test-user.name > .ownerId$test-item': {
						value: 'shoup'
					}
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
					operation: {
						value: 'shoup'
					}
				}]
			});

			expect(res)
			.to.deep.equal([{
				item: 'item-1',
				categoryName: 'category-1'
			}]);
		});

		it('should properly generate a sql request - setting 2', async function(){
			connectorExecute = [{
				'item': 'item-1',
				'categoryName': 'category-1'
			}];

			nexus.configureComposite('test-comp', {
				base: 'test-item',
				key: 'id',
				fields: {
					'item': '.name',
					'categoryName':  '> $test-category.name'
				}
			});
			
			const comp = await nexus.loadComposite('test-comp');
			
			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			const res = await doc.query({
				joins: {
					'$test-category.name': {
						value: 'foo-bar'
					}
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
					path: 'name',
					operation: {
						value: 'foo-bar'
					}
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
				key: 'id',
				fields: {
					'item': '.name',
					'categoryName':  '> $test-category.name'
				}
			});

			const comp = await nexus.loadComposite('test-comp');

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			const res = await doc.normalize({
				item: 'item-1',
				categoryName: 'category-1'
			});

			expect(res.instructions.toJSON())
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
				key: 'id',
				fields: {
					'id': '.id',
					'item': '.name',
					'categoryId': '> $test-category.id',
					'categoryName':  '> $test-category.name'
				}
			});

			const comp = await nexus.loadComposite('test-comp');

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);
			await doc.link();

			const res = await doc.normalize({
				id: 123,
				item: 'item-1',
				categoryId: 456,
				categoryName: 'category-1'
			});

			expect(res.instructions.toJSON())
			.to.deep.equal({
				'test-item': [{
					$ref: 'test-item:1',
					$type: 'update',
					id: 123,
					name: 'item-1'
				}],
				'test-category': [{
					$ref: 'test-category:1',
					$type: 'update',
					id: 456,
					name: 'category-1',
					itemId: 'test-item:1'
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
				key: 'id',
				fields: {
					'item': '.name',
					'categoryName':  '> $test-category.name'
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
			await doc.link();

			const res = await doc.push({
				item: 'item-1',
				categoryName: 'category-1'
			}, context);

			expect(res)
			.to.deep.equal([
				{
					id: 1,
					name: 'item-created'
				},
				{
					id: 1,
					name: 'category-created'
				}
			]);
		});

		it('should load decode a object push - 2', async function(){
			const items = await nexus.loadCrud('test-item');

			const categories = await nexus.loadCrud('test-category');

			const comp = await nexus.configureComposite('test-comp', {
				base: 'test-item',
				key: 'id',
				fields: {
					'id': '.id',
					'item': '.name',
					'categoryId': '> $test-category.id',
					'categoryName':  '> $test-category.name'
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

			stubs.deflateSpy = sinon.spy(normalized, 'deflate');

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
					$ref: 'test-item:1',
					$type: 'update',
					id: 123,
					name: 'item-1'
				}],
				'test-category': [{
					$ref: 'test-category:1',
					$type: 'update',
					id: 456,
					name: 'category-1',
					itemId: 'test-item:1'
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					id: 'item-update-1',
					name: 'item-update'
				},
				{
					id: 1,
					name: 'category-update'
				}
			]);

			expect(stubs.item.getCall(0).args[0])
			.to.equal(789); // this comes from the read's result

			expect(stubs.category.getCall(0).args[0])
			.to.deep.equal(987);
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
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name',
					'items': ['> $test-category > #test-composite-item']
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

			stubs.deflateSpy = sinon.spy(normalized, 'deflate');

			permissions = {
				admin: true
			};

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);

			const res = await doc.push({
				id: 12,
				name: 'family-1',
				items: [{
					id: 34,
					item: 'item-1',
					categoryId: 56, 
					categoryName: 'category-1'
				}, {
					id: 78,
					item: 'item-2',
					categoryName: 'category-2'
				}]
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-family': [{
					$ref: 'test-family:1',
					$type: 'update',
					id: 12,
					name: 'family-1'
				}],
				'test-item': [{
					$ref: 'test-item:2',
					$type: 'update',
					id: 34,
					name: 'item-1'
				},{
					$ref: 'test-item:3',
					$type: 'update',
					id: 78,
					name: 'item-2'
				}],
				'test-category': [{
					$ref: 'test-category:2',
					$type: 'update',
					id: 56,
					name: 'category-1',
					itemId: 'test-item:2',
					familyId: 'test-family:1'
				},{
					$ref: 'test-category:3',
					$type: 'create',
					id: undefined,
					name: 'category-2',
					itemId: 'test-item:3',
					familyId: 'test-family:1'
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					id: 'family-1',
					name: 'family-updated'
				},
				{
					id: 'item-1',
					name: 'item-updated'
				}, {
					id: 'item-2',
					name: 'item-updated'
				}, {
					id: 'cat-1',
					name: 'category-update'
				}, {
					id: 'cat-2',
					name: 'category-created'
				} 
			]);

			expect(stubs.itemRead.getCall(0).args[0])
			.to.equal(34);

			expect(stubs.itemRead.getCall(1).args[0])
			.to.equal(78);

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
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name',
					'categoryName': '> $test-category.name',
					'tags': ['> $test-category > #test-composite-tag']
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

			stubs.deflateSpy = sinon.spy(normalized, 'deflate');

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
					name: 'tag-name-1'
				}, {
					name: 'tag-name-2'
				}]
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-family': [{
					$ref: 'test-family:1',
					$type: 'update',
					id: 12,
					name: 'family-name-1'
				}],
				'test-category': [{
					$ref: 'test-category:1',
					$type: 'create',
					id: undefined,
					name: 'category-name-1',
					familyId: 'test-family:1'
				}],
				'test-tag': [{
					$ref: 'test-tag:2',
					$type: 'create',
					name: 'tag-name-1',
					categoryId: 'test-category:1'
				},{
					$ref: 'test-tag:3',
					$type: 'create',
					name: 'tag-name-2',
					categoryId: 'test-category:1'
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					id: 'family-1',
					name: 'family-updated'
				}, {
					id: 'cat-1',
					name: 'category-created'
				}, {
					id: 'tag-1',
					name: 'tag-created'
				}, {
					id: 'tag-2',
					name: 'tag-created'
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
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name',
					'tags': ['> $test-category > #test-composite-tag']
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

			stubs.deflateSpy = sinon.spy(normalized, 'deflate');

			permissions = {
				admin: true
			};

			const doc = new sut.Document(comp);
			
			await doc.configure(connector);

			const res = await doc.push({
				id: 12,
				name: 'family-name-1',
				tags: [{
					name: 'tag-name-1'
				}, {
					name: 'tag-name-2'
				}]
			}, context);

			expect(stubs.deflateSpy.getCall(0).args[0].toJSON())
			.to.deep.equal({
				'test-family': [{
					$ref: 'test-family:1',
					$type: 'update',
					id: 12,
					name: 'family-name-1'
				}],
				'test-category': [{
					$ref: 'test-category:2',
					$type: 'create',
					familyId: 'test-family:1'
				},{
					$ref: 'test-category:3',
					$type: 'create',
					familyId: 'test-family:1'
				}],
				'test-tag': [{
					$ref: 'test-tag:2',
					$type: 'create',
					name: 'tag-name-1',
					categoryId: 'test-category:2'
				},{
					$ref: 'test-tag:3',
					$type: 'create',
					name: 'tag-name-2',
					categoryId: 'test-category:3'
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					id: 'family-1',
					name: 'family-updated'
				}, {
					id: 'cat-1',
					name: 'category-created'
				}, {
					id: 'cat-1',
					name: 'category-created'
				}, {
					id: 'tag-1',
					name: 'tag-created'
				}, {
					id: 'tag-2',
					name: 'tag-created'
				}
			]);

			expect(stubs.familyRead.getCall(0).args[0])
			.to.deep.equal(12);
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
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name'
				}
			});
			await nexus.configureDocument('test-material', connector);

			await nexus.configureComposite('test-composite-material', {
				base: 'test-item-material',
				key: 'id',
				extends: 'test-material',
				fields: {
					'pivot': '.id'
				}
			});
			await nexus.configureDocument('test-composite-material', connector);

			await nexus.configureComposite('test-composite-material-2', {
				base: 'test-item-material',
				key: 'id',
				extends: 'test-composite-material',
				fields: {
					'mask': '.mask'
				}
			});
			await nexus.configureDocument('test-composite-material-2', connector);

			await nexus.configureComposite('test-composite-ut', {
				base: 'test-item',
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name',
					'materials': ['> #test-composite-material-2']
				}
			});
			await nexus.configureDocument('test-composite-ut', connector);
		});

		it('should work when creating brand new', async function(){
			items = await nexus.loadCrud('test-item');
			itemMaterials = await nexus.loadCrud('test-item-material');
			materials = await nexus.loadCrud('test-material');

			comp = await nexus.loadComposite('test-composite-ut');
			
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

			stubs.deflateSpy = sinon.spy(normalized, 'deflate');

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
					$ref: 'test-material:2',
					$type: 'create',
					id: undefined,
					name: 'material-name-1'
				}],
				'test-item-material': [{
					$ref: 'test-item-material:2',
					$type: 'create',
					id: undefined,
					itemId: 'test-item:1',
					materialId: 'test-material:2',
					mask: undefined
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					id: 'item-1',
					name: 'item-created'
				}, {
					id: 'material-1',
					name: 'material-created'
				}, {
					id: 'im-1',
					itemId: 'item-1-1',
					materialId: 'material-1-1'
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

			comp = await nexus.loadComposite('test-composite-ut');

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

			stubs.deflateSpy = sinon.spy(normalized, 'deflate');

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
					$ref: 'test-item:1',
					$type: 'update',
					id: 'item-id-1',
					name: 'item-name-10'
				}],
				'test-material': [{
					$ref: 'test-material:2',
					$type: 'update',
					id: 'material-1',
					name: 'material-name-10'
				}],
				'test-item-material': [{
					$ref: 'test-item-material:2',
					$type: 'update',
					id: 'join-1',
					itemId: 'test-item:1',
					materialId: 'test-material:2',
					mask: 'it-is-a-cowl'
				}]
			});

			expect(res)
			.to.deep.equal([
				{
					id: 'item-1',
					name: 'item-updated'
				}, {
					id: 'material-1',
					name: 'material-updated'
				}, {
					id: 'im-1',
					itemId: 'item-1-1',
					materialId: 'material-1-1'
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
		const changeTypes = require('../schema/model.js').config.get('changeTypes');

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
			let typeCb = null;
			let changeCb = null;

			beforeEach(async function(){
				await nexus.configureComposite('test-material', {
					base: 'test-material',
					key: 'id',
					fields: {
						'id': '.id',
						'name': '.name'
					}
				});
				await nexus.configureDocument('test-material', connector);

				await nexus.configureComposite('test-composite-material', {
					base: 'test-item-material',
					key: 'id',
					extends: 'test-material',
					fields: {
						'pivot': '.id'
					},
					getChangeType: async function(doc){
						return typeCb(doc);
					}
				});
				await nexus.configureDocument('test-composite-material', connector);

				await nexus.configureComposite('test-composite-ut', {
					base: 'test-item',
					key: 'id',
					fields: {
						'id': '.id',
						'name': '.name',
						'materials': ['> #test-composite-material']
					},
					onChange: async function(type, instructions){
						return changeCb(type, instructions);
					}
				});
				doc = await nexus.configureDocument('test-composite-ut', connector);
			});

			it('should work with a null type change', async function(){
				typeCb = function(){
					return null;
				};

				changeCb = function(type){
					expect(type)
					.to.equal(null);
				};

				await doc.push({
					id: 'item-id-1',
					name: 'item-name-10',
					materials: [{
						pivot: 'join-1',
						id: 'material-1',
						name: 'material-name-10'
					}]
				}, context);
			});

			it('should work with a major type change', async function(){
				typeCb = function(){
					return changeTypes.major;
				};

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
						name: 'material-name-10'
					}]
				}, context);
			});

			it('should work with a minor type change', async function(){
				typeCb = function(){
					return changeTypes.minor;
				};

				changeCb = function(type){
					expect(type)
					.to.equal(changeTypes.minor);
				};

				await doc.push({
					id: 'item-id-1',
					name: 'item-name-10',
					materials: [{
						pivot: 'join-1',
						id: 'material-1',
						name: 'material-name-10'
					}]
				}, context);
			});

			it('should allow major to override with minor first', async function(){
				let count = 0;

				typeCb = function(){
					if (count){
						count++;

						return changeTypes.major;
					} else {
						count++;

						return changeTypes.minor;
					}
				};

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
						name: 'material-name-10'
					}, {
						pivot: 'join-2',
						id: 'material-2',
						name: 'material-name-20'
					}]
				}, context);

				expect(count)
				.to.equal(2);
			});

			it('should allow major to override with major first', async function(){
				let count = 0;

				typeCb = function(){
					if (count){
						count++;

						return changeTypes.minor;
					} else {
						count++;

						return changeTypes.major;
					}
				};

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
						name: 'material-name-10'
					}, {
						pivot: 'join-2',
						id: 'material-2',
						name: 'material-name-20'
					}]
				}, context);

				expect(count)
				.to.equal(2);
			});

			it('should allow major to override with major in the middle', async function(){
				let count = 0;

				typeCb = function(){
					if (count === 1){
						count++;

						return changeTypes.major;
					} else {
						count++;

						return changeTypes.minor;
					}
				};

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
						name: 'material-name-10'
					}, {
						pivot: 'join-2',
						id: 'material-2',
						name: 'material-name-20'
					}, {
						pivot: 'join-3',
						id: 'material-3',
						name: 'material-name-30'
					}]
				}, context);

				expect(count)
				.to.equal(3);
			});
		});

		describe('assign getChangeType via extends', async function(){
			let typeCb = null;
			let changeCb = null;

			beforeEach(async function(){
				await nexus.configureComposite('test-material', {
					base: 'test-material',
					key: 'id',
					fields: {
						'id': '.id',
						'name': '.name'
					},
					getChangeType: async function(doc){
						return typeCb(doc);
					}
				});
				await nexus.configureDocument('test-material', connector);

				await nexus.configureComposite('test-item', {
					base: 'test-item',
					key: 'id',
					fields: {
						'id': '.id',
						'name': '.name'
					}
				});
				await nexus.configureDocument('test-item', connector);

				await nexus.configureComposite('test-mappings', {
					base: 'test-item-material',
					key: 'id',
					fields: {
						'itemId': '.itemId',
						'materialId': '.materialId'
					}
				});
				await nexus.configureDocument('test-mappings', connector);

				await nexus.configureComposite('test-composite-material', {
					base: 'test-item-material',
					key: 'id',
					extends: 'test-material',
					fields: {
						'pivot': '.id'
					}
				});
				await nexus.configureDocument('test-composite-material', connector);

				await nexus.configureComposite('test-composite-ut', {
					base: 'test-item',
					key: 'id',
					fields: {
						'id': '.id',
						'name': '.name',
						'materials': ['> #test-composite-material']
					},
					onChange: async function(type, instructions){
						return changeCb(type, instructions);
					}
				});

				doc = await nexus.configureDocument('test-composite-ut', connector);
			});

			it('should work with a null type change', async function(){
				let count = 0;

				typeCb = function(){
					if (count === 1){
						count++;

						return changeTypes.major;
					} else {
						count++;

						return changeTypes.minor;
					}
				};

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
						name: 'material-name-10'
					}, {
						pivot: 'join-2',
						id: 'material-2',
						name: 'material-name-20'
					}, {
						pivot: 'join-3',
						id: 'material-3',
						name: 'material-name-30'
					}]
				}, context);

				expect(count)
				.to.equal(3);
			});
		});
	});

	describe('multi tiered', function(){
		let doc = null;

		const changeTypes = require('../schema/model.js').config.get('changeTypes');

		beforeEach(async function(){
			await nexus.configureComposite('test-material', {
				base: 'test-material',
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name'
				}
			});
			await nexus.configureDocument('test-material', connector);

			await nexus.configureComposite('test-item', {
				base: 'test-item',
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name'
				}
			});
			await nexus.configureDocument('test-item', connector);

			await nexus.configureComposite('test-mappings', {
				base: 'test-item-material',
				key: 'id',
				fields: {
					'itemId': '.itemId',
					'materialId': '.materialId'
				}
			});
			await nexus.configureDocument('test-mappings', connector);

			stubs.getChangeType = sinon.stub();
			await nexus.configureComposite('test-composite-material', {
				base: 'test-item-material',
				key: 'id',
				extends: 'test-material',
				fields: {
					'pivot': '.id'
				},
				getChangeType: stubs.getChangeType
			});
			await nexus.configureDocument('test-composite-material', connector);

			stubs.onChange = sinon.stub()
			.callsFake(function(type, series){
				const datum = series.get('test-item')[0];

				if (type === changeTypes.major){
					datum.setField('name', datum.getField('name')+'.1');
				} else {
					datum.setField('name', datum.getField('name')+'.2');
				}
			});
			await nexus.configureComposite('test-composite-ut', {
				base: 'test-item',
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name',
					'materials': ['> #test-composite-material']
				},
				onChange: stubs.onChange
			});
			await nexus.configureDocument('test-composite-ut', connector);

			await nexus.configureComposite('test-ownership', {
				base: 'test-user',
				key: 'id',
				fields: {
					'id': '.id',
					'name': '.name',
					'items': ['.id > .ownerId#test-composite-ut']
				}
			});

			// this schema makes no sense in practicality...
			await nexus.configureComposite('test-god', {
				base: 'test-user',
				key: 'id',
				fields: {
					'id': '.id',
					'items': ['.id > .creatorId#test-item'],
					'materials': ['.id > .creatorId#test-material'],
					'mappings': ['.id > .creatorId#test-mappings']
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

			stubs.deflateSpy = sinon.spy(normalized, 'deflate');

			stubs.getChangeType.onCall(0)
			.resolves(changeTypes.major);

			stubs.getChangeType.onCall(1)
			.resolves(changeTypes.minor);

			stubs.getChangeType.onCall(2)
			.resolves(changeTypes.major);

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
					name: 'item-name-20',
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
					'$ref': 'test-user:1',
					'$type': 'update',
					'id': 'user-id-1',
					'name': 'user-name-10'
				}],
				'test-item': [{
					'$ref': 'test-item:2',
					'$type': 'update',
					'id': 'item-id-1',
					'name': 'item-name-10.1',
					'creatorId': 'test-user:1'
				},
				{
					'$ref': 'test-item:3',
					'$type': 'update',
					'id': 'item-id-2',
					'name': 'item-name-20.2',
					'creatorId': 'test-user:1'
				},
				{
					'$ref': 'test-item:4',
					'$type': 'update',
					'id': 'item-id-3',
					'name': 'item-name-30.1',
					'creatorId': 'test-user:1'
				}],
				'test-material': [{
					'$ref': 'test-material:5',
					'$type': 'update',
					'id': 'material-1',
					'name': 'material-name-10'
				},
				{
					'$ref': 'test-material:6',
					'$type': 'update',
					'id': 'material-2',
					'name': 'material-name-20'
				},
				{
					'$ref': 'test-material:7',
					'$type': 'update',
					'id': 'material-3',
					'name': 'material-name-30'
				}],
				'test-item-material': [{
					'$ref': 'test-item-material:5',
					'$type': 'update',
					'id': 'join-1',
					'materialId': 'test-material:5',
					'itemId': 'test-item:2'
				},
				{
					'$ref': 'test-item-material:6',
					'$type': 'update',
					'id': 'join-2',
					'materialId': 'test-material:6',
					'itemId': 'test-item:3'
				},
				{
					'$ref': 'test-item-material:7',
					'$type': 'update',
					'id': 'join-3',
					'materialId': 'test-material:7',
					'itemId': 'test-item:4'
				}]
			});

			let series = null;

			//-------------
			expect(stubs.onChange.getCall(0).args[0])
			.to.equal(changeTypes.major);

			series = stubs.onChange.getCall(0).args[1];
			
			expect(series.get('test-item').length)
			.to.equal(1);

			//-------------
			expect(stubs.onChange.getCall(1).args[0])
			.to.equal(changeTypes.minor);

			series = stubs.onChange.getCall(1).args[1];

			expect(series.get('test-item').length)
			.to.equal(1);

			//-------------
			expect(stubs.onChange.getCall(2).args[0])
			.to.equal(changeTypes.major);

			series = stubs.onChange.getCall(2).args[1];
			expect(series.get('test-item').length)
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

			stubs.deflateSpy = sinon.spy(normalized, 'deflate');

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
					'$ref': 'test-user:1',
					'$type': 'update',
					'id': 'user-id'
				}],
				'test-item': [{
					'$ref': '$item-id-1',
					'$type': 'update-create',
					'id': '$item-id-1',
					'name': 'item-name-10',
					'creatorId': 'test-user:1'
				},
				{
					'$ref': '$item-id-2',
					'$type': 'update-create',
					'id': '$item-id-2',
					'name': 'item-name-20',
					'creatorId': 'test-user:1'
				},
				{
					'$ref': '$item-id-3',
					'$type': 'update-create',
					'id': '$item-id-3',
					'name': 'item-name-30',
					'creatorId': 'test-user:1'
				}],
				'test-material': [{
					'$ref': '$material-id-1',
					'$type': 'update-create',
					'id': '$material-id-1',
					'name': 'material-name-10',
					'creatorId': 'test-user:1'
				},
				{
					'$ref': '$material-id-2',
					'$type': 'update-create',
					'id': '$material-id-2',
					'name': 'material-name-20',
					'creatorId': 'test-user:1'
				},
				{
					'$ref': '$material-id-3',
					'$type': 'update-create',
					'id': '$material-id-3',
					'name': 'material-name-30',
					'creatorId': 'test-user:1'
				}],
				'test-item-material': [{
					'$ref': 'test-item-material:8',
					'$type': 'create',
					'materialId': '$material-id-1',
					'itemId': '$item-id-1',
					'creatorId': 'test-user:1'
				},
				{
					'$ref': 'test-item-material:9',
					'$type': 'create',
					'materialId': '$material-id-2',
					'itemId': '$item-id-2',
					'creatorId': 'test-user:1'
				},
				{
					'$ref': 'test-item-material:10',
					'$type': 'create',
					'materialId': '$material-id-3',
					'itemId': '$item-id-2',
					'creatorId': 'test-user:1'
				},
				{
					'$ref': 'test-item-material:11',
					'$type': 'create',
					'materialId': '$material-id-3',
					'itemId': '$item-id-3',
					'creatorId': 'test-user:1'
				}]
			});
		});
	});
});
