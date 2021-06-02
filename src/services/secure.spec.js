
const {expect} = require('chai');
const sinon = require('sinon');

const {Model} = require('../schema/model.js');
const {Crud} = require('./crud.js');
const {Context} = require('../server/context.js');

const sut = require('./secure.js');

describe('src/services/secure.js', function(){
	let ctx = null;
	let stubs = null;

	beforeEach(function(){
		ctx = new Context();
		stubs = {};
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => {
			if (stub.restore){
				stub.restore();
			}
		});
	});

	describe('base functionality', function(){
		let base = null;

		beforeEach(function(){
			base = {
				security: {}
			};
		});

		describe('::canCreate', function(){
			it('should define a base method', async function(){
				sut.secure(base, {
					canCreate: async (datum) => {
						return datum.id === 10;
					}
				});

				expect(await base.security.canCreate({id:10}))
				.to.equal(true);

				expect(await base.security.canCreate({id:20}))
				.to.equal(false);
			});

			it('should define with multiple', async function(){
				sut.secure(base, {
					canCreate: async (datum) => {
						return datum.id % 3 === 0;
					}
				});

				sut.secure(base, {
					canCreate: async (datum) => {
						return datum.id % 2 === 0;
					}
				});

				expect(await base.security.canCreate({id:3}))
				.to.equal(false);

				expect(await base.security.canCreate({id:2}))
				.to.equal(false);

				expect(await base.security.canCreate({id:6}))
				.to.equal(true);
			});
		});

		describe('::canRead', function(){
			it('should define a base method', async function(){
				sut.secure(base, {
					canRead: async (datum) => {
						return datum.id === 10;
					}
				});

				expect(await base.security.canRead({id:10}))
				.to.equal(true);

				expect(await base.security.canRead({id:20}))
				.to.equal(false);
			});

			it('should define with multiple', async function(){
				sut.secure(base, {
					canRead: async (datum) => {
						return datum.id % 3 === 0;
					}
				});

				sut.secure(base, {
					canRead: async (datum) => {
						return datum.id % 2 === 0;
					}
				});

				expect(await base.security.canRead({id:3}))
				.to.equal(false);

				expect(await base.security.canRead({id:2}))
				.to.equal(false);

				expect(await base.security.canRead({id:6}))
				.to.equal(true);
			});
		});

		describe('::filterFactory', function(){
			it('should define a base method', async function(){
				sut.secure(base, {
					filterFactory: () => function(datum){
						return datum.value % 2 === 0;
					}
				});

				const filterFn = await base.security.filterFactory();

				expect([
					{value: 1},
					{value: 2},
					{value: 3}
				].filter(filterFn))
				.to.deep.equal([
					{value: 2}
				]);
			});

			it('should extend a base method', async function(){
				sut.secure(base, {
					filterFactory: () => function(datum){
						return datum.value % 2 === 0;
					}
				});

				sut.secure(base, {
					filterFactory: () => function(datum){
						return datum.other === 'b';
					}
				});

				const filterFn = await base.security.filterFactory();

				expect([
					{value: 1, other: 'a'},
					{value: 2, other: 'a'},
					{value: 3, other: 'b'},
					{value: 4, other: 'b'},
					{value: 5, other: 'b'},
					{value: 6, other: 'b'},
					{value: 7, other: 'b'},
					{value: 8, other: 'b'},
					{value: 9, other: 'b'},
					{value: 10, other: 'b'}
				].filter(filterFn))
				.to.deep.equal([
					{value: 4, other: 'b'},
					{value: 6, other: 'b'},
					{value: 8, other: 'b'},
					{value: 10, other: 'b'}
				]);
			});

			it('should stack three times', async function(){
				sut.secure(base, {
					filterFactory: () => function(datum){
						return datum.value % 2 === 0;
					}
				});

				sut.secure(base, {
					filterFactory: () => function(datum){
						return datum.other === 'b';
					}
				});

				sut.secure(base, {
					filterFactory: () => function(datum){
						return datum.value % 3 === 0;
					}
				});

				const filterFn = await base.security.filterFactory();

				expect([
					{value: 1, other: 'a'},
					{value: 2, other: 'a'},
					{value: 3, other: 'b'},
					{value: 4, other: 'b'},
					{value: 5, other: 'b'},
					{value: 6, other: 'b'},
					{value: 7, other: 'b'},
					{value: 8, other: 'b'},
					{value: 9, other: 'b'},
					{value: 10, other: 'b'}
				].filter(filterFn))
				.to.deep.equal([
					{value: 6, other: 'b'}
				]);
			});
		});
	});

	describe('via a Service', function(){
		let model = null;
		let service = null;

		beforeEach(async function(){
			stubs.execute = sinon.stub();

			model = new Model('model-1', {
				execute: (...args) => stubs.execute(...args)
			});

			await model.configure({
				connector: 'stub',
				fields: {
					id: {
						key: true,
						read: true
					},
					eins: {
						create: true,
						read: true,
						update: true
					},
					zwei: {
						create: true,
						read: true,
						update: true
					},
					drei: {
						create: true,
						read: true,
						update: true
					}
				}
			});

			service = new Crud(model);

			await service.configure();
		});

		describe('::canCreate', function(){
			describe('.create', function(){
				beforeEach(function(){
					stubs.execute.resolves([
						{eins: 10, zwei: 20, drei: 30}
					]);
				});

				it('should work', async function(){
					sut.secure(service, {
						canCreate: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					const res = await service.create({
						eins: 1,
						zwei: 2,
						drei: 3
					}, ctx);

					expect(res)
					.to.deep.equal({
						eins: 10,
						zwei: 20,
						drei: 30
					});
				});

				it('should fail', async function(){
					let failed = false;

					sut.secure(service, {
						canCreate: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					try {
						const res = await service.create({
							eins: 1,
							zwei: 21,
							drei: 3
						}, ctx);

						expect(res)
						.to.deep.equal({
							eins: 10,
							zwei: 20,
							drei: 30
						});
					} catch(ex){
						failed = true;

						expect(ex.code)
						.to.equal('BMOOR_CRUD_SERVICE_CAN_CREATE');
					}

					expect(failed)
					.to.equal(true);
				});
			});
		});

		describe('::canRead', function(){
			describe('.read', function(){
				it('should work', async function(){
					stubs.execute.resolves([
						{eins: 10, zwei: 20, drei: 30}
					]);

					sut.secure(service, {
						canRead: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					const res = await service.read(1, ctx);

					expect(res)
					.to.deep.equal({
						eins: 10,
						zwei: 20,
						drei: 30
					});
				});

				it('should fail', async function(){
					let failed = false;

					stubs.execute.resolves([
						{eins: 10, zwei: 21, drei: 30}
					]);

					sut.secure(service, {
						canRead: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					try {
						const res = await service.read(2, ctx);

						expect(res)
						.to.deep.equal({
							eins: 10,
							zwei: 20,
							drei: 30
						});
					} catch(ex){
						failed = true;

						expect(ex.code)
						.to.equal('BMOOR_CRUD_SERVICE_CAN_READ');
					}

					expect(failed)
					.to.equal(true);
				});
			});

			describe('.readAll', function(){
				it('should work', async function(){
					stubs.execute.resolves([
						{eins: 10, zwei: 20, drei: 30},
						{eins: 11, zwei: 21, drei: 31},
						{eins: 12, zwei: 22, drei: 32},
						{eins: 13, zwei: 23, drei: 33}
					]);

					sut.secure(service, {
						canRead: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					const res = await service.readAll(ctx);

					expect(res)
					.to.deep.equal([
						{eins: 10, zwei: 20, drei: 30},
						{eins: 12, zwei: 22, drei: 32}
					]);
				});
			});

			describe('.readMany', function(){
				it('should work', async function(){
					stubs.execute.resolves([
						{eins: 10, zwei: 20, drei: 30},
						{eins: 11, zwei: 21, drei: 31},
						{eins: 12, zwei: 22, drei: 32},
						{eins: 13, zwei: 23, drei: 33}
					]);

					sut.secure(service, {
						canRead: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					const res = await service.readMany([1,2], ctx);

					expect(res)
					.to.deep.equal([
						{eins: 10, zwei: 20, drei: 30},
						{eins: 12, zwei: 22, drei: 32}
					]);
				});
			});

			describe('.query', function(){
				it('should work', async function(){
					stubs.execute.resolves([
						{eins: 10, zwei: 20, drei: 30},
						{eins: 11, zwei: 21, drei: 31},
						{eins: 12, zwei: 22, drei: 32},
						{eins: 13, zwei: 23, drei: 33}
					]);

					sut.secure(service, {
						canRead: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					const res = await service.query({}, ctx);

					expect(res)
					.to.deep.equal([
						{eins: 10, zwei: 20, drei: 30},
						{eins: 12, zwei: 22, drei: 32}
					]);
				});
			});

			describe('.update', function(){
				// if you can't read it, you can't update it.  Security is in the read
				// part of the class
				it('should work', async function(){
					stubs.execute.resolves([
						{eins: 10, zwei: 20, drei: 30}
					]);

					sut.secure(service, {
						canRead: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					const res = await service.update(1, {}, ctx);

					expect(res)
					.to.deep.equal({
						eins: 10,
						zwei: 20,
						drei: 30
					});
				});

				it('should fail', async function(){
					let failed = false;

					stubs.execute.resolves([
						{eins: 10, zwei: 21, drei: 30}
					]);

					sut.secure(service, {
						canRead: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					try {
						const res = await service.update(2, {}, ctx);

						expect(res)
						.to.deep.equal({
							eins: 10,
							zwei: 20,
							drei: 30
						});
					} catch(ex){
						failed = true;

						expect(ex.code)
						.to.equal('BMOOR_CRUD_SERVICE_CAN_READ');
					}

					expect(failed)
					.to.equal(true);
				});
			});

			describe('.delete', function(){
				// if you can't read it, you can't delete it.  Security is in the read
				// part of the class
				it('should work', async function(){
					stubs.execute.resolves([
						{eins: 10, zwei: 20, drei: 30}
					]);

					sut.secure(service, {
						canRead: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					const res = await service.delete(1, ctx);

					expect(res)
					.to.deep.equal({
						eins: 10,
						zwei: 20,
						drei: 30
					});
				});

				it('should fail', async function(){
					let failed = false;

					stubs.execute.resolves([
						{eins: 10, zwei: 21, drei: 30}
					]);

					sut.secure(service, {
						canRead: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					try {
						const res = await service.delete(2, ctx);

						expect(res)
						.to.deep.equal({
							eins: 10,
							zwei: 20,
							drei: 30
						});
					} catch(ex){
						failed = true;

						expect(ex.code)
						.to.equal('BMOOR_CRUD_SERVICE_CAN_READ');
					}

					expect(failed)
					.to.equal(true);
				});
			});
		});

		describe('::canUpdate', function(){
			describe('.update', function(){
				it('should work', async function(){
					stubs.execute.resolves([
						{eins: 10, zwei: 20, drei: 30}
					]);

					sut.secure(service, {
						canUpdate: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					const res = await service.update(1, {}, ctx);

					expect(res)
					.to.deep.equal({
						eins: 10,
						zwei: 20,
						drei: 30
					});
				});

				it('should fail', async function(){
					let failed = false;

					stubs.execute.resolves([
						{eins: 10, zwei: 21, drei: 30}
					]);

					sut.secure(service, {
						canUpdate: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					try {
						const res = await service.update(2, {}, ctx);

						expect(res)
						.to.deep.equal({
							eins: 10,
							zwei: 20,
							drei: 30
						});
					} catch(ex){
						failed = true;

						expect(ex.code)
						.to.equal('BMOOR_CRUD_SERVICE_CAN_UPDATE');
					}

					expect(failed)
					.to.equal(true);
				});
			});
		});

		describe('::canDelete', function(){
			describe('.delete', function(){
				it('should work', async function(){
					stubs.execute.resolves([
						{eins: 10, zwei: 20, drei: 30}
					]);

					sut.secure(service, {
						canUpdate: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					const res = await service.delete(1, ctx);

					expect(res)
					.to.deep.equal({
						eins: 10,
						zwei: 20,
						drei: 30
					});
				});

				it('should fail', async function(){
					let failed = false;

					stubs.execute.resolves([
						{eins: 10, zwei: 21, drei: 30}
					]);

					sut.secure(service, {
						canDelete: async (datum) => {
							return datum.zwei % 2 === 0;
						}
					});

					try {
						const res = await service.delete(2, ctx);

						expect(res)
						.to.deep.equal({
							eins: 10,
							zwei: 20,
							drei: 30
						});
					} catch(ex){
						failed = true;

						expect(ex.code)
						.to.equal('BMOOR_CRUD_SERVICE_CAN_DELETE');
					}

					expect(failed)
					.to.equal(true);
				});
			});
		});
	});
});