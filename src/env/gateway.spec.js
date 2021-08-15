
const {expect} = require('chai');
const sinon = require('sinon');

const {Config} = require('bmoor/src/lib/config.js');

const sut = require('./gateway.js');

describe('src/env/gateway.js', function(){
	let stubs = null;
	let stubbedNexus = null;

	beforeEach(function(){
		stubs = {
			configureGuard: sinon.stub(),
			configureAction: sinon.stub(),
			configureUtility: sinon.stub(),
			configureSynthetic: sinon.stub()
		};

		stubbedNexus = {
			configureGuard: stubs.configureGuard,
			configureAction: stubs.configureAction,
			configureUtility: stubs.configureUtility,
			configureSynthetic: stubs.configureSynthetic
		};
	});

	afterEach(function(){
		Object.values(stubs)
		.forEach(stub => {
			if (stub.restore){
				stub.restore();
			}
		});
	});

	it('should load everything correctly', async function(){
		const cfg = new Config({
			guards: [{
				name: 'guard-file',
				settings: {
					option: 1
				}
			}],
			actions: [{
				name: 'action-file',
				settings: {
					option: 2
				}
			}],
			utilities: [{
				name: 'utility-file',
				settings: {
					option: 3
				}
			}],
			synthetics: [{
				name: 'synthetic-file',
				settings: {
					option: 4
				}
			}]
		});

		//--- guard ---

		stubs.configureGuard
		.resolves({
			iAm: 'a guard'
		});

		//--- action ---

		stubs.configureAction
		.resolves({
			iAm: 'a action'
		});

		//--- utility ---
		stubs.configureUtility
		.resolves({
			iAm: 'a utility'
		});

		//--- synthetic ---
		stubs.configureSynthetic
		.resolves({
			iAm: 'a synthetic'
		});

		const gateway = new sut.Gateway(stubbedNexus);

		sinon.stub(gateway, 'installQuerier')
		.resolves({hello: 'world'});

		const res = await gateway.install(cfg);

		//--- results ---
		expect(stubs.configureGuard.getCall(0).args)
		.to.deep.equal([
			'guard-file',
			{ option: 1 }
		]);

		expect(stubs.configureAction.getCall(0).args)
		.to.deep.equal([
			'action-file',
			{ option: 2 }
		]);

		expect(stubs.configureUtility.getCall(0).args)
		.to.deep.equal([
			'utility-file',
			{ option: 3 }
		]);

		expect(stubs.configureSynthetic.getCall(0).args)
		.to.deep.equal([
			'synthetic-file',
			{ option: 4 }
		]);

		expect(res)
		.to.deep.equal({
			guards: [{
				iAm: 'a guard'
			}],
			actions: [{
				iAm: 'a action'
			}],
			utilities: [{
				iAm: 'a utility'
			}],
			synthetics: [{
				iAm: 'a synthetic'
			}],
			querier: {
				hello: 'world'
			}
		});
	});

	describe('stubbed', function(){
		it('should load everything correctly', async function(){
			const mockery = new Config();

			//--- guard ---
			mockery.set('guards', [
				{
					name: 'a-guard',
					settings: {
						option: 1
					}
				}
			]);

			stubs.configureGuard
			.resolves({
				iAm: 'a guard'
			});

			//--- action ---
			mockery.set('actions', [
				{
					name: 'a-action',
					settings: {
						option: 2
					}
				}
			]);

			stubs.configureAction
			.resolves({
				iAm: 'a action'
			});

			//--- utility ---
			mockery.set('utilities', [
				{
					name: 'a-utility',
					settings: {
						option: 3
					}
				}
			]);

			stubs.configureUtility
			.resolves({
				iAm: 'a utility'
			});

			//--- synthetic ---
			mockery.set('synthetics', [
				{
					name: 'a-synthetic',
					settings: {
						option: 4
					}
				}
			]);

			stubs.configureSynthetic
			.resolves({
				iAm: 'a synthetic'
			});

			const gateway = new sut.Gateway(stubbedNexus);

			sinon.stub(gateway, 'installQuerier')
			.resolves({hello: 'world'});

			const res = await gateway.install(mockery);

			//--- results ---
			expect(stubs.configureGuard.getCall(0).args)
			.to.deep.equal([
				'a-guard',
				{ option: 1 }
			]);

			expect(stubs.configureAction.getCall(0).args)
			.to.deep.equal([
				'a-action',
				{ option: 2 }
			]);

			expect(stubs.configureUtility.getCall(0).args)
			.to.deep.equal([
				'a-utility',
				{ option: 3 }
			]);

			expect(stubs.configureSynthetic.getCall(0).args)
			.to.deep.equal([
				'a-synthetic',
				{ option: 4 }
			]);

			expect(res)
			.to.deep.equal({
				guards: [{
					iAm: 'a guard'
				}],
				actions: [{
					iAm: 'a action'
				}],
				utilities: [{
					iAm: 'a utility'
				}],
				synthetics: [{
					iAm: 'a synthetic'
				}],
				querier: {
					hello: 'world'
				}
			});
		});
	});
});