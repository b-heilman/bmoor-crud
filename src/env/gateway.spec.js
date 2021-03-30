
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
			setGuard: sinon.stub(),
			setAction: sinon.stub(),
			setUtility: sinon.stub(),
			setSynthetic: sinon.stub()
		};

		stubbedNexus = {
			setGuard: stubs.setGuard,
			setAction: stubs.setAction,
			setUtility: stubs.setUtility,
			setSynthetic: stubs.setSynthetic
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

		stubs.setGuard
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

		stubs.setAction
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

		stubs.setUtility
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

		stubs.setSynthetic
		.resolves({
			iAm: 'a synthetic'
		});

		const gateway = new sut.Gateway(stubbedNexus);

		const res = await gateway.install(directories);

		//--- results ---
		expect(stubs.setGuard.getCall(0).args)
		.to.deep.equal([
			'guard-file',
			{ option: 1 }
		]);

		expect(stubs.setAction.getCall(0).args)
		.to.deep.equal([
			'action-file',
			{ option: 2 }
		]);

		expect(stubs.setUtility.getCall(0).args)
		.to.deep.equal([
			'utility-file',
			{ option: 3 }
		]);

		expect(stubs.setSynthetic.getCall(0).args)
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
			mockery.set('guard', [
				{
					name: 'a-guard',
					settings: {
						option: 1
					}
				}
			]);

			stubs.setGuard
			.resolves({
				iAm: 'a guard'
			});

			//--- action ---
			mockery.set('action', [
				{
					name: 'a-action',
					settings: {
						option: 2
					}
				}
			]);

			stubs.setAction
			.resolves({
				iAm: 'a action'
			});

			//--- utility ---
			mockery.set('utility', [
				{
					name: 'a-utility',
					settings: {
						option: 3
					}
				}
			]);

			stubs.setUtility
			.resolves({
				iAm: 'a utility'
			});

			//--- synthetic ---
			mockery.set('synthetic', [
				{
					name: 'a-synthetic',
					settings: {
						option: 4
					}
				}
			]);

			stubs.setSynthetic
			.resolves({
				iAm: 'a synthetic'
			});

			const gateway = new sut.Gateway(stubbedNexus);

			const res = await gateway.install(directories, mockery);

			//--- results ---
			expect(stubs.setGuard.getCall(0).args)
			.to.deep.equal([
				'a-guard',
				{ option: 1 }
			]);

			expect(stubs.setAction.getCall(0).args)
			.to.deep.equal([
				'a-action',
				{ option: 2 }
			]);

			expect(stubs.setUtility.getCall(0).args)
			.to.deep.equal([
				'a-utility',
				{ option: 3 }
			]);

			expect(stubs.setSynthetic.getCall(0).args)
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