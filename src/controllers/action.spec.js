const {expect} = require('chai');
const sinon = require('sinon');

const {Nexus} = require('../env/nexus.js');
const {Context} = require('../server/context.js');

const sut = require('./action.js');

describe('src/controller/action.js', function () {
	let stubs = {};
	let nexus = null;
	let service = null;
	let connectorResult = null;

	beforeEach(async function () {
		nexus = new Nexus();

		connectorResult = {};

		stubs = {
			execute: sinon.stub().callsFake(async function () {
				return connectorResult;
			})
		};

		await nexus.setConnector('test', async () => ({
			execute: async (...args) => stubs.execute(...args)
		}));

		await nexus.configureSource('test-1', {
			connector: 'test'
		});

		nexus.configureModel('service-1', {
			source: 'test-1',
			fields: {
				id: {
					create: false,
					read: true,
					update: false,
					key: true
				},
				name: {
					create: false,
					read: false,
					update: false,
					query: true
				}
			}
		});

		service = await nexus.configureCrud('service-1');
	});

	afterEach(function () {
		Object.values(stubs).forEach((stub) => {
			if (stub.restore) {
				stub.restore();
			}
		});
	});

	describe('allowing for a method to be called', function () {
		const {Action} = sut;

		it('should work', async function () {
			let called = false;

			stubs.read = sinon
				.stub(service, 'read')
				.resolves({id: 'eins', name: 'hello-world'});

			service.fooBar = function () {
				called = true;

				return 'eins-zwei';
			};

			const action = new Action(service);

			await action.configure({
				'foo-bar': {
					method: 'get'
				}
			});

			const context = new Context({
				method: 'get',
				params: {
					id: 1234,
					action: 'foo-bar'
				}
			});

			const res = await action.route(context);

			expect(called).to.equal(true);

			expect(res).to.equal('eins-zwei');
		});

		it('should fail if permission fails', async function () {
			let called = false;

			stubs.read = sinon
				.stub(service, 'read')
				.resolves({id: 'eins', name: 'hello-world'});

			service.fooBar = function () {
				called = true;

				return 'eins-zwei';
			};

			const action = new Action(service);

			await action.configure({
				'foo-bar': {
					method: 'get',
					permission: 'oh-boy'
				}
			});

			const context = new Context({
				method: 'get',
				params: {
					id: 1234,
					action: 'foo-bar'
				}
			});

			context.hasPermission = function (perm) {
				expect(perm).to.equal('oh-boy');

				return false;
			};

			let failed = false;
			try {
				const res = await action.route(context);

				expect(called).to.equal(true);

				expect(res).to.equal('eins-zwei');
			} catch (ex) {
				failed = true;

				expect(ex.code).to.equal('ACTION_CONTROLLER_PERMISSION');
			}

			expect(failed).to.equal(true);

			expect(called).to.equal(false);
		});

		it('should succeed if permission allows', async function () {
			let called = false;

			stubs.read = sinon
				.stub(service, 'read')
				.resolves({id: 'eins', name: 'hello-world'});

			service.fooBar = function () {
				called = true;

				return 'eins-zwei';
			};

			const action = new Action(service);

			await action.configure({
				'foo-bar': {
					method: 'get',
					permission: 'oh-boy'
				}
			});

			const context = new Context({
				method: 'get',
				params: {
					id: 1234,
					action: 'foo-bar'
				}
			});

			context.hasPermission = function (perm) {
				expect(perm).to.equal('oh-boy');

				return true;
			};

			let failed = false;
			try {
				const res = await action.route(context);

				expect(called).to.equal(true);

				expect(res).to.equal('eins-zwei');
			} catch (ex) {
				failed = true;

				expect(ex.code).to.equal('ACTION_CONTROLLER_PERMISSION');
			}

			expect(failed).to.equal(false);

			expect(called).to.equal(true);
		});
	});

	it('should fail if a method not defined is called', async function () {
		const {Action} = sut;

		let called = false;

		const action = new Action(service);

		await action.configure({
			'foo-bar': {
				method: 'get',
				permission: 'oh-boy'
			}
		});

		const context = new Context({
			method: 'get',
			params: {
				id: 1234,
				action: 'foo-bar'
			},
			permissions: {
				'oh-boy': true
			}
		});

		let failed = false;
		try {
			const res = await action.route(context);

			expect(called).to.equal(true);

			expect(res).to.equal('eins-zwei');
		} catch (ex) {
			failed = true;

			expect(ex.code).to.equal('ACTION_CONTROLLER_METHOD');
		}

		expect(failed).to.equal(true);

		expect(called).to.equal(false);
	});

	it('should fail if an action not defined is called', async function () {
		const {Action} = sut;

		let called = false;

		const action = new Action(service);

		await action.configure({
			'foo-bar': {
				method: 'get',
				permission: 'oh-boy'
			}
		});

		const context = new Context({
			method: 'get',
			params: {
				id: 1234,
				action: 'foo-bar2'
			}
		});

		let failed = false;
		try {
			const res = await action.route(context);

			expect(called).to.equal(true);

			expect(res).to.equal('eins-zwei');
		} catch (ex) {
			failed = true;

			expect(ex.code).to.equal('ACTION_CONTROLLER_NO_ACTION');
		}

		expect(failed).to.equal(true);

		expect(called).to.equal(false);
	});

	it('should fail if the http method is incorrect', async function () {
		const {Action} = sut;

		let called = false;

		const action = new Action(service);

		await action.configure({
			'foo-bar': {
				method: 'get',
				permission: 'oh-boy'
			}
		});

		const context = new Context({
			method: 'post',
			params: {
				id: 1234,
				action: 'foo-bar'
			}
		});

		let failed = false;
		try {
			const res = await action.route(context);

			expect(called).to.equal(true);

			expect(res).to.equal('eins-zwei');
		} catch (ex) {
			failed = true;

			expect(ex.code).to.equal('ACTION_CONTROLLER_WRONG_METHOD');
		}

		expect(failed).to.equal(true);

		expect(called).to.equal(false);
	});
});
