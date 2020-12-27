
const {expect} = require('chai');
const sinon = require('sinon');

const sut = require('./controller.js');

describe('src/server/controller.js', function(){
	let stubs = null;

	beforeEach(function(){
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

	it('should return back the response by default', async function(){
		const ctrl = new sut.Controller();
		
		function test(){
			return {
				foo: 'bar'
			};
		}

		const route = ctrl.prepareRoute(
			{},
			{
				route: {
					path: 'test/route',
					method: 'post'
				},
				fn: test,
				enableRollback: true
			}
		);

		const res = await route.action({});

		expect(res)
		.to.deep.equal({
			result: {
				foo: 'bar'
			}
		});
	});

	it('should return back the response by default', async function(){
		const ctrl = new sut.Controller();
		
		function test(){
			return {
				foo: 'bar'
			};
		}

		const route = ctrl.prepareRoute(
			{},
			{
				route: {
					method: 'post',
					path: 'test/route'
				},
				fn: test,
				enableRollback: true,
				formatResponse: function(res){
					expect(res)
					.to.deep.equal({
						foo: 'bar'
					});

					return {
						hello: 'world'
					};
				} 
			}
		);

		const res = await route.action({});

		expect(res)
		.to.deep.equal({
			hello: 'world'
		});
	});


	it('should perform rollback on error', async function(){
		const ctrl = new sut.Controller();
		
		function test(ctx){
			ctx.addChange('model-1', 'create', {}, {});
			ctx.addChange('model-2', 'create', {}, {});
			ctx.addChange('model-3', 'create', {}, {});
			ctx.addChange('model-1', 'update', {}, {});

			throw new Error('testing');
		}

		stubs.delete = sinon.stub()
		.resolves({});

		stubs.update = sinon.stub()
		.resolves({});

		stubs.loadService = sinon.stub()
		.resolves({
			delete: stubs.delete,
			update: stubs.update,
			schema: {
				getKey: () => 'key'
			}
		});

		let failed = false;
		try {
			const route = ctrl.prepareRoute(
				{
					loadService: stubs.loadService
				},{
					route: {
						method: 'post',
						path: 'test/route'
					},
					fn: test,
					enableRollback: true
				}
			);

			await route.action({});
		} catch( ex ){
			failed = true;
		}
		
		expect(failed)
		.to.equal(true);

		expect(stubs.loadService.callCount)
		.to.equal(4);

		expect(stubs.loadService.getCall(0).args[0])
		.to.equal('model-1');

		expect(stubs.loadService.getCall(1).args[0])
		.to.equal('model-3');

		expect(stubs.loadService.getCall(2).args[0])
		.to.equal('model-2');

		expect(stubs.loadService.getCall(3).args[0])
		.to.equal('model-1');
	});

	it('should not perform rollback on error if not enabled', async function(){
		const ctrl = new sut.Controller();
		
		function test(ctx){
			ctx.addChange('model-1', 'create', {}, {});
			ctx.addChange('model-2', 'create', {}, {});
			ctx.addChange('model-3', 'create', {}, {});
			ctx.addChange('model-1', 'update', {}, {});

			throw new Error('testing');
		}

		stubs.delete = sinon.stub()
		.resolves({});

		stubs.update = sinon.stub()
		.resolves({});

		stubs.loadService = sinon.stub()
		.resolves({
			delete: stubs.delete,
			update: stubs.update,
			schema: {
				getKey: () => 'key'
			}
		});

		let failed = false;
		try {
			const route = ctrl.prepareRoute(
				{
					loadService: stubs.loadService
				}, {
					route: {
						method: 'post',
						path: 'test/route'
					},
					fn: test,
					enableRollback: false
				}
			);

			await route.action({});
		} catch( ex ){
			failed = true;
		}
		
		expect(failed)
		.to.equal(true);

		expect(stubs.loadService.callCount)
		.to.equal(0);
	});

	it('should return a list of changes if one is available', async function(){
		const ctrl = new sut.Controller();
		
		async function test(ctx){
			ctx.addChange('model-1', 'create', {value: 1}, {value: 2});

			return {hello: 'world'};
		}

		const route = ctrl.prepareRoute(
			{
				loadService: stubs.loadService
			}, {
				route: {
					method: 'post',
					path: 'test/route'
				},
				fn: test,
				enableRollback: false
			}
		);

		const res = await route.action({});

		expect(res)
		.to.deep.equal({
			result: {hello: 'world'},
			changes: {
				'model-1': [{
					action: 'create',
					datum: {value: 2}
				}]
			}
		});
	});

	it('should return a list of changes if multiple are available', async function(){
		const ctrl = new sut.Controller();
		
		async function test(ctx){
			ctx.addChange('model-1', 'create', 1, {value: 1}, {value: 2});
			ctx.addChange('model-2', 'create', 2, null, {foo: 'bar'});
			ctx.addChange('model-3', 'delete', 3, {hello: 'world'}, null);
			ctx.addChange('model-1', 'update', 4, {value: 3}, {value: 4});

			return {hello: 'world'};
		}

		const route = ctrl.prepareRoute(
			{
				loadService: stubs.loadService
			}, {
				route: {
					method: 'post',
					path: 'test/route'
				},
				fn: test,
				enableRollback: false
			}
		);

		const res = await route.action({});

		expect(res)
		.to.deep.equal({
			result: {hello: 'world'},
			changes: {
				'model-1': [{
					action: 'create',
					datum: {value: 2}
				}, {
					action: 'update',
					datum: {value: 4}
				}],
				'model-2': [{
					action: 'create',
					datum: {foo: 'bar'}
				}],
				'model-3': [{
					action: 'delete',
					datum: {hello: 'world'}
				}]
			}
		});
	});
});
