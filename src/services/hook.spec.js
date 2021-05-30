
const {expect} = require('chai');

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
			base = {
				hooks: {}
			};
		});

		describe('::beforeCreate', async function(){
			it('should define a base method', async function(){
				const trace = [];

				sut.hook(base, {
					beforeCreate: async function(){
						trace.push(1);
					}
				});

				await base.hooks.beforeCreate();

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

				await base.hooks.beforeCreate();

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

				await base.hooks.afterCreate();

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

				await base.hooks.afterCreate();

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

				await base.hooks.beforeUpdate();

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

				await base.hooks.beforeUpdate();

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

				await base.hooks.afterUpdate();

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

				await base.hooks.afterUpdate();

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

				await base.hooks.beforeDelete();

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

				await base.hooks.beforeDelete();

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

				await base.hooks.afterDelete();

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

				await base.hooks.afterDelete();

				expect(trace)
				.to.deep.equal([1, 2]);
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

				const mapFn = await base.hooks.mapFactory();

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

				const mapFn = await base.hooks.mapFactory();

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

				const mapFn = await base.hooks.mapFactory();

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
	});
});