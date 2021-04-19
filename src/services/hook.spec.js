
const {expect} = require('chai');
const sinon = require('sinon');

const {Model} = require('../schema/model.js');
const {Crud} = require('./crud.js');
const {Context} = require('../server/context.js');

const sut = require('./hook.js');

describe('src/services/hook.js', function(){
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
			base = {};
		});

		describe('::beforeCreate', async function(){
			it('should define a base method', async function(){
				const trace = [];

				sut.hook(base, {
					beforeCreate: async function(){
						trace.push(1);
					}
				});

				await base._beforeCreate();

				expect(trace)
				.to.deep.equal([1]);
			});

			it('should extend a base method', async function(){
				const trace = [];

				sut.hook(base, {
					beforeCreate: async function(){
						trace.push(1);
					}
				});

				sut.hook(base, {
					beforeCreate: async function(){
						trace.push(2);
					}
				});

				await base._beforeCreate();

				expect(trace)
				.to.deep.equal([2, 1]);
			});
		});

		describe('::afterCreate', function(){
			it('should define a base method', async function(){
				const trace = [];

				sut.hook(base, {
					afterCreate: async function(){
						trace.push(1);
					}
				});

				await base._afterCreate();

				expect(trace)
				.to.deep.equal([1]);
			});

			it('should extend a base method', async function(){
				const trace = [];

				sut.hook(base, {
					afterCreate: async function(){
						trace.push(1);
					}
				});

				sut.hook(base, {
					afterCreate: async function(){
						trace.push(2);
					}
				});

				await base._afterCreate();

				expect(trace)
				.to.deep.equal([1, 2]);
			});
		});

		describe('::beforeUpdate', function(){
			it('should define a base method', async function(){
				const trace = [];

				sut.hook(base, {
					beforeUpdate: async function(){
						trace.push(1);
					}
				});

				await base._beforeUpdate();

				expect(trace)
				.to.deep.equal([1]);
			});

			it('should extend a base method', async function(){
				const trace = [];

				sut.hook(base, {
					beforeUpdate: async function(){
						trace.push(1);
					}
				});

				sut.hook(base, {
					beforeUpdate: async function(){
						trace.push(2);
					}
				});

				await base._beforeUpdate();

				expect(trace)
				.to.deep.equal([2, 1]);
			});
		});

		describe('::afterUpdate', function(){
			it('should define a base method', async function(){
				const trace = [];

				sut.hook(base, {
					afterUpdate: async function(){
						trace.push(1);
					}
				});

				await base._afterUpdate();

				expect(trace)
				.to.deep.equal([1]);
			});

			it('should extend a base method', async function(){
				const trace = [];

				sut.hook(base, {
					afterUpdate: async function(){
						trace.push(1);
					}
				});

				sut.hook(base, {
					afterUpdate: async function(){
						trace.push(2);
					}
				});

				await base._afterUpdate();

				expect(trace)
				.to.deep.equal([1, 2]);
			});
		});

		describe('::beforeDelete', function(){
			it('should define a base method', async function(){
				const trace = [];

				sut.hook(base, {
					beforeDelete: async function(){
						trace.push(1);
					}
				});

				await base._beforeDelete();

				expect(trace)
				.to.deep.equal([1]);
			});

			it('should extend a base method', async function(){
				const trace = [];

				sut.hook(base, {
					beforeDelete: async function(){
						trace.push(1);
					}
				});

				sut.hook(base, {
					beforeDelete: async function(){
						trace.push(2);
					}
				});

				await base._beforeDelete();

				expect(trace)
				.to.deep.equal([2, 1]);
			});
		});

		describe('::afterDelete', function(){
			it('should define a base method', async function(){
				const trace = [];

				sut.hook(base, {
					afterDelete: async function(){
						trace.push(1);
					}
				});

				await base._afterDelete();

				expect(trace)
				.to.deep.equal([1]);
			});

			it('should extend a base method', async function(){
				const trace = [];

				sut.hook(base, {
					afterDelete: async function(){
						trace.push(1);
					}
				});

				sut.hook(base, {
					afterDelete: async function(){
						trace.push(2);
					}
				});

				await base._afterDelete();

				expect(trace)
				.to.deep.equal([1, 2]);
			});
		});

		describe('::canCreate', function(){
			it('should define a base method', async function(){
				sut.hook(base, {
					canCreate: async (datum) => {
						return datum.id === 10;
					}
				});

				expect(await base._canCreate({id:10}))
				.to.equal(true);

				expect(await base._canCreate({id:20}))
				.to.equal(false);
			});

			it('should define with multiple', async function(){
				sut.hook(base, {
					canCreate: async (datum) => {
						return datum.id % 3 === 0;
					}
				});

				sut.hook(base, {
					canCreate: async (datum) => {
						return datum.id % 2 === 0;
					}
				});

				expect(await base._canCreate({id:3}))
				.to.equal(false);

				expect(await base._canCreate({id:2}))
				.to.equal(false);

				expect(await base._canCreate({id:6}))
				.to.equal(true);
			});
		});

		describe('::canRead', function(){
			it('should define a base method', async function(){
				sut.hook(base, {
					canRead: async (datum) => {
						return datum.id === 10;
					}
				});

				expect(await base._canRead({id:10}))
				.to.equal(true);

				expect(await base._canRead({id:20}))
				.to.equal(false);
			});

			it('should define with multiple', async function(){
				sut.hook(base, {
					canRead: async (datum) => {
						return datum.id % 3 === 0;
					}
				});

				sut.hook(base, {
					canRead: async (datum) => {
						return datum.id % 2 === 0;
					}
				});

				expect(await base._canRead({id:3}))
				.to.equal(false);

				expect(await base._canRead({id:2}))
				.to.equal(false);

				expect(await base._canRead({id:6}))
				.to.equal(true);
			});
		});

		describe('::mapFactory', function(){
			it('should define a base method', async function(){
				sut.hook(base, {
					mapFactory: () => function(datum){
						datum.eins = 10;

						return datum;
					}
				});

				const mapFn = await base._mapFactory();

				expect([{uno: 1},{dos: 2}].map(mapFn))
				.to.deep.equal([
					{
						uno: 1,
						eins: 10
					},
					{
						dos: 2,
						eins: 10
					}
				]);
			});

			it('should extend a base method', async function(){
				sut.hook(base, {
					mapFactory: () => function(datum){
						datum.eins = 1;
						return datum;
					}
				});

				sut.hook(base, {
					mapFactory: () => function(datum){
						datum.zwei = 2;
						return datum;
					}
				});

				const mapFn = await base._mapFactory();

				expect([{uno: 1},{dos: 2}].map(mapFn))
				.to.deep.equal([
					{
						uno: 1,
						eins: 1,
						zwei: 2
					},
					{
						dos: 2,
						eins: 1,
						zwei: 2
					}
				]);
			});

			it('should stack three times', async function(){
				sut.hook(base, {
					mapFactory: () => function(datum){
						datum.eins = 1;
						return datum;
					}
				});

				sut.hook(base, {
					mapFactory: () => function(datum){
						datum.zwei = 2;
						return datum;
					}
				});

				sut.hook(base, {
					mapFactory: () => function(datum){
						datum.drei = 3;
						return datum;
					}
				});

				const mapFn = await base._mapFactory();

				expect([{uno: 1},{dos: 2}].map(mapFn))
				.to.deep.equal([
					{
						uno: 1,
						eins: 1,
						zwei: 2,
						drei: 3
					},
					{
						dos: 2,
						eins: 1,
						zwei: 2,
						drei: 3
					}
				]);
			});
		});

		describe('::filterFactory', function(){
			it('should define a base method', async function(){
				sut.hook(base, {
					filterFactory: () => function(datum){
						return datum.value % 2 === 0;
					}
				});

				const filterFn = await base._filterFactory();

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
				sut.hook(base, {
					filterFactory: () => function(datum){
						return datum.value % 2 === 0;
					}
				});

				sut.hook(base, {
					filterFactory: () => function(datum){
						return datum.other === 'b';
					}
				});

				const filterFn = await base._filterFactory();

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
				sut.hook(base, {
					filterFactory: () => function(datum){
						return datum.value % 2 === 0;
					}
				});

				sut.hook(base, {
					filterFactory: () => function(datum){
						return datum.other === 'b';
					}
				});

				sut.hook(base, {
					filterFactory: () => function(datum){
						return datum.value % 3 === 0;
					}
				});

				const filterFn = await base._filterFactory();

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
			model = new Model('model-1');

			await model.configure({
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

			stubs.execute = sinon.stub();

			await service.configure({execute: stubs.execute});
		});

		describe('::canCreate', function(){
			describe('.create', function(){
				beforeEach(function(){
					stubs.execute.resolves([
						{eins: 10, zwei: 20, drei: 30}
					]);
				});

				it('should work', async function(){
					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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

					sut.hook(service, {
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