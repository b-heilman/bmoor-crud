
const {expect} = require('chai');
const sinon = require('sinon');

const loader = require('../server/loader.js');
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
		const directories = new Config();

		stubs.getFiles = sinon.stub(loader, 'getFiles');
		stubs.getSettings = sinon.stub(loader, 'getSettings');

		//--- guard ---
		directories.set('guard', 'guard/file');

		stubs.getFiles.withArgs('guard/file')
		.resolves([
			{
				name: 'guard-file',
				path: '/junk/guard/file'
			}
		]);

		stubs.getSettings.withArgs('/junk/guard/file')
		.resolves({
			option: 1
		});

		stubs.configureGuard
		.resolves({
			iAm: 'a guard'
		});

		//--- action ---
		directories.set('action', 'action/file');

		stubs.getFiles.withArgs('action/file')
		.resolves([
			{
				name: 'action-file',
				path: '/junk/action/file'
			}
		]);

		stubs.getSettings.withArgs('/junk/action/file')
		.resolves({
			option: 2
		});

		stubs.configureAction
		.resolves({
			iAm: 'a action'
		});

		//--- utility ---
		directories.set('utility', 'utility/file');

		stubs.getFiles.withArgs('utility/file')
		.resolves([
			{
				name: 'utility-file',
				path: '/junk/utility/file'
			}
		]);

		stubs.getSettings.withArgs('/junk/utility/file')
		.resolves({
			option: 3
		});

		stubs.configureUtility
		.resolves({
			iAm: 'a utility'
		});

		//--- synthetic ---
		directories.set('synthetic', 'synthetic/file');

		stubs.getFiles.withArgs('synthetic/file')
		.resolves([
			{
				name: 'synthetic-file',
				path: '/junk/synthetic/file'
			}
		]);

		stubs.getSettings.withArgs('/junk/synthetic/file')
		.resolves({
			option: 4
		});

		stubs.configureSynthetic
		.resolves({
			iAm: 'a synthetic'
		});

		const gateway = new sut.Gateway(stubbedNexus);

		const res = await gateway.install(directories);

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
			}]
		});
	});

	describe('stubbed', function(){
		it('should load everything correctly', async function(){
			const directories = new Config();
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

			const res = await gateway.install(directories, mockery);

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
				}]
			});
		});
	});
});