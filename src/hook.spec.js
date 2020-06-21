
const {expect} = require('chai');
// const sinon = require('sinon');

// const {Model} = require('./Model.js');
// const {Service} = require('./Service.js');
const {hook} = require('./hook.js');

describe('src/hook.js', function(){
	let stubs = null;

	beforeEach(function(){
		stubs = {};
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => stub.restore());
	});

	describe('base functionality', function(){
		let base = null;

		beforeEach(function(){
			base = {};
		});

		describe('::beforeCreate', async function(){
			it('should define a base method', async function(){
				const trace = [];

				hook(base, {
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

				hook(base, {
					beforeCreate: async function(){
						trace.push(1);
					}
				});

				hook(base, {
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

				hook(base, {
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

				hook(base, {
					afterCreate: async function(){
						trace.push(1);
					}
				});

				hook(base, {
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

				hook(base, {
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

				hook(base, {
					beforeUpdate: async function(){
						trace.push(1);
					}
				});

				hook(base, {
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

				hook(base, {
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

				hook(base, {
					afterUpdate: async function(){
						trace.push(1);
					}
				});

				hook(base, {
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

				hook(base, {
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

				hook(base, {
					beforeDelete: async function(){
						trace.push(1);
					}
				});

				hook(base, {
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

				hook(base, {
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

				hook(base, {
					afterDelete: async function(){
						trace.push(1);
					}
				});

				hook(base, {
					afterDelete: async function(){
						trace.push(2);
					}
				});

				await base._afterDelete();

				expect(trace)
				.to.deep.equal([1, 2]);
			});
		});

		describe('::mapFactory', function(){
			it('should define a base method', async function(){
				hook(base, {
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
				hook(base, {
					mapFactory: () => function(datum){
						datum.eins = 1;
						return datum;
					}
				});

				hook(base, {
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
				hook(base, {
					mapFactory: () => function(datum){
						datum.eins = 1;
						return datum;
					}
				});

				hook(base, {
					mapFactory: () => function(datum){
						datum.zwei = 2;
						return datum;
					}
				});

				hook(base, {
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
				hook(base, {
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
				hook(base, {
					filterFactory: () => function(datum){
						return datum.value % 2 === 0;
					}
				});

				hook(base, {
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
				hook(base, {
					filterFactory: () => function(datum){
						return datum.value % 2 === 0;
					}
				});

				hook(base, {
					filterFactory: () => function(datum){
						return datum.other === 'b';
					}
				});

				hook(base, {
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

	});
});