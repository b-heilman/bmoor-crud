
const {expect} = require('chai');
const sinon = require('sinon');

const {Nexus} = require('../env/nexus.js');
const {Context} = require('../server/context.js');

describe('src/controller/synthetic.js', function(){
	const sut = require('./synthetic.js');

	let nexus = null;
	let stubs = null;
	
	let permissions = null;

	let doc = null;

	beforeEach(async function(){
		permissions = {};

		stubs = {};

		nexus = new Nexus();

		//-----------------
		await nexus.configureModel('test-user', {
			fields: {
				id: {
					read: true,
					key: true
				},
				name: {
					read: true,
					write: true,
					update: true,
					delete: true,
					query: true
				}
			}
		});
		await nexus.configureCrud('test-user', {});

		nexus.configureComposite('test-ownership', {
			base: 'test-user',
			key: 'id',
			fields: {
				'id': '.id',
				'name': '.name'
			}
		});

		doc = await nexus.configureDocument('test-ownership', {});
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => {
			if (stub.restore){
				stub.restore();
			}
		});
	});

	describe('method(get)', function(){
		let context = null;

		beforeEach(function(){
			context = new Context({method: 'get'});
			context.hasPermission = (perm) => !!permissions[perm];
		});

		describe('::read', function(){
			beforeEach(function(){
				stubs.read = sinon.stub(doc, 'read');
			});

			it('should reject if not readable', async function(){
				const synth = new sut.Synthetic(doc);

				await synth.configure({readable: false});

				let failed = false;
				try {
					await synth.route(context);
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('DOCUMENT_CONTROLLER_READ_UNAVAILABLE');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should reject if not read permission', async function(){
				const synth = new sut.Synthetic(doc);

				await synth.configure({readable: true, read:'can-read'});

				let failed = false;
				try {
					await synth.route(context);
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('DOCUMENT_CONTROLLER_READ_PERMISSION');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should succeed if reading by id', async function(){
				const synth = new sut.Synthetic(doc);

				await synth.configure({readable: true, read:'can-read'});

				context.params = {
					id: 'req-1'
				};

				permissions = {'can-read': true};

				stubs.read.resolves({hello: 'world'});

				const res = await synth.route(context);

				const args = stubs.read.getCall(0).args;

				expect(args[0])
				.to.equal('req-1');

				expect(res)
				.to.deep.equal({hello: 'world'});
			});
		});


		describe('::query', function(){
			beforeEach(function(){
				stubs.query = sinon.stub(doc, 'query');
			});

			it('should succeed if reading by query', async function(){
				const synth = new sut.Synthetic(doc);

				await synth.configure({readable: true, read:'can-read'});

				context.query = {
					param: {
						id: 123,
						name: 'req-1'
					}
				};

				permissions = {'can-read': true};

				stubs.query.resolves({hello: 'world'});

				const res = await synth.route(context);

				const args = stubs.query.getCall(0).args;

				expect(args[0])
				.to.deep.equal({
					params: {name: 'req-1'},
					joins: [],
					sort: null,
					position: {
						limit: null
					}
				});

				expect(res)
				.to.deep.equal({hello: 'world'});
			});
		});
	});

	describe('method(post)', function(){
		let context = null;

		beforeEach(function(){
			context = new Context({method: 'post'});
			context.hasPermission = (perm) => !!permissions[perm];
		});

		describe('::push', function(){
			beforeEach(function(){
				stubs.push = sinon.stub(doc, 'push');
			});

			it('should reject if not readable', async function(){
				const synth = new sut.Synthetic(doc);

				await synth.configure({writable: false});

				let failed = false;
				try {
					await synth.route(context);
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('DOCUMENT_CONTROLLER_WRITE_UNAVAILABLE');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should reject if not write permission', async function(){
				const synth = new sut.Synthetic(doc);

				await synth.configure({writable: true, write:'can-write'});

				let failed = false;
				try {
					await synth.route(context);
				} catch(ex){
					failed = true;

					expect(ex.code)
					.to.equal('DOCUMENT_CONTROLLER_WRITE_PERMISSION');
				}

				expect(failed)
				.to.equal(true);
			});

			it('should succeed if writing', async function(){
				const synth = new sut.Synthetic(doc);

				await synth.configure({writable: true, read:'can-write'});

				context.content = {
					id: 'req-1'
				};

				permissions = {'can-write': true};

				stubs.push.resolves({hello: 'world'});

				const res = await synth.route(context);

				const args = stubs.push.getCall(0).args;

				expect(args[0])
				.to.deep.equal({id: 'req-1'});

				expect(res)
				.to.deep.equal({hello: 'world'});
			});
		});
	});
});
