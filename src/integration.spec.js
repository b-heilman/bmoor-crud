const sinon = require('sinon');
const fetch = require('node-fetch');
const express = require('express');
const {expect} = require('chai');
const bodyParser = require('body-parser');

const {Config, ConfigObject} = require('bmoor/src/lib/config.js');
const {factory: httpConnector} = require('./connectors/http.js');

const {build, config} = require('./index.js');

async function buildBootstrap(app, settings) {
	const localStub = sinon.stub();
	const httpStub = sinon.stub();

	const bootstrapCfg = config.getSub('bootstrap').override(
		{},
		{
			connectors: new Config({
				local: () => ({
					execute: localStub
				}),
				http: httpConnector
			}),
			sources: new Config({
				local: new ConfigObject({
					connector: 'local'
				}),
				http: new ConfigObject({
					connector: 'http',
					connectorSettings: {
						// TODO: do I want different bases based on query structure?
						// TODO: rename this variable, it's not the crud base
						crudBase: 'http://localhost:9091/bmoor'
					}
				})
			}),
			directories: new Config({
				// do not load any directories
			})
		}
	);

	const cfg = config.override(
		{},
		{
			bootstrap: bootstrapCfg,
			server: new Config({
				buildRouter: () => express.Router()
			})
		}
	);

	return {
		bootstrap: await build(app, cfg, settings),
		localStub,
		httpStub
	};
}

describe('integration tests', function () {
	this.timeout(5000);

	let server1 = null;
	let server2 = null;
	let instance1 = null;
	let instance2 = null;

	beforeEach(async function () {
		const app1 = express();

		app1.use(bodyParser.urlencoded({extended: false}));
		app1.use(bodyParser.json());

		instance1 = await buildBootstrap(app1, {
			cruds: [
				{
					name: 'user',
					settings: {
						source: 'local',
						fields: {
							id: {
								create: false,
								read: true,
								update: false,
								delete: true,
								key: true
							},
							name: true,
							title: true,
							content: {
								create: true,
								read: true,
								update: true,
								delete: false,
								jsonType: 'object',
								usage: 'json'
							}
						}
					}
				},
				{
					name: 'team',
					settings: {
						source: 'local',
						fields: {
							id: {
								create: false,
								read: true,
								update: false,
								delete: true,
								key: true,
								query: true
							},
							name: {
								create: true,
								read: true,
								update: true,
								delete: true
							},
							userId: {
								create: true,
								read: true,
								update: true,
								link: {
									name: 'user',
									field: 'id'
								}
							}
						}
					}
				}
			],
			guards: [
				{
					name: 'service-1',
					settings: {
						read: true,
						query: true,
						create: true,
						update: true,
						delete: true
					}
				}
			],
			documents: [
				{
					name: 'team-info',
					settings: {
						base: 'team',
						joins: ['.userId > $user'],
						fields: {
							id: '.id',
							name: '.name',
							owner: {
								name: '$user.name',
								content: '$user.content'
							}
						}
					}
				}
			],
			synthetics: [
				{
					name: 'team-info',
					settings: {
						readable: true,
						read: false // no access controls
					}
				}
			]
		});

		const app2 = express();

		app2.use(bodyParser.urlencoded({extended: false}));
		app2.use(bodyParser.json());

		instance2 = await buildBootstrap(app2, {
			cruds: [
				{
					name: 'company',
					settings: {
						source: 'local',
						fields: {
							id: {
								create: false,
								read: true,
								update: false,
								delete: true,
								key: true
							},
							name: {
								create: true,
								read: true,
								update: true,
								delete: true
							},
							userId: {
								create: true,
								read: true,
								update: true,
								link: {
									name: 'service-1',
									field: 'id'
								}
							}
						}
					}
				},
				{
					name: 'team',
					schema: 'team-info',
					settings: {
						source: 'http',
						fields: {
							id: {
								create: false,
								read: true,
								update: false,
								delete: true,
								key: true
							},
							name: true,
							ownerName: true,
							content: {
								create: true,
								read: true,
								update: true,
								delete: false,
								jsonType: 'object',
								usage: 'json'
							}
						}
					}
				},
				{
					name: 'company-team',
					settings: {
						source: 'local',
						fields: {
							id: {
								create: false,
								read: true,
								update: false,
								delete: true,
								key: true
							},
							name: {
								create: true,
								read: true,
								update: true,
								delete: true
							},
							teamId: {
								create: true,
								read: true,
								update: true,
								link: {
									name: 'team',
									field: 'id'
								}
							},
							companyId: {
								create: true,
								read: true,
								update: true,
								link: {
									name: 'company',
									field: 'id'
								}
							}
						}
					}
				}
			],
			guards: [
				{
					name: 'service-1',
					settings: {
						read: true,
						query: true,
						create: true,
						update: true,
						delete: true
					}
				}
			],
			documents: [
				{
					name: 'company-info',
					settings: {
						base: 'company',
						joins: ['> $company-team > $team'],
						fields: {
							id: '.id',
							company: '.name',
							team: '$team.name',
							user: '$team.ownerName',
							content: '$team.content'
						}
					}
				}
			],
			synthetics: [
				{
					name: 'team-info',
					settings: {
						readable: true,
						read: false
					}
				}
			]
		});

		return Promise.all([
			new Promise((resolve) => {
				server1 = app1.listen(9091, resolve);
			}),
			new Promise((resolve) => {
				server2 = app1.listen(9092, resolve);
			})
		]);
	});

	afterEach(async function () {
		return Promise.all([
			new Promise((resolve) => {
				server1.close(resolve);
			}),
			new Promise((resolve) => {
				server2.close(resolve);
			})
		]);
	});

	describe('instance-1 validation', function () {
		it('should work on the base service by id', async function () {
			instance1.localStub.resolves([
				{
					id: 'id-1',
					name: 'name-1',
					owner: {
						name: 'owner-1',
						content: '{"foo":"bar"}'
					}
				},
				{
					id: 'id-2',
					name: 'name-2',
					owner: {
						name: 'owner-2',
						content: '{"foo":"bar"}'
					}
				}
			]);

			try {
				const res = await (
					await fetch('http://localhost:9091/bmoor/synthetic/team-info/3')
				).json();

				expect(res).to.deep.equal({
					result: {
						id: 'id-1',
						name: 'name-1',
						owner: {
							name: 'owner-1',
							content: {
								foo: 'bar'
							}
						}
					}
				});
				// console.log('args =>', args);
			} catch (ex) {
				console.log('ex', ex);

				throw ex;
			}
		});

		it('should work on the base service with many', async function () {
			instance1.localStub.resolves([
				{
					id: 'id-1',
					name: 'name-1',
					owner: {
						name: 'owner-1',
						content: '{"foo":"bar"}'
					}
				},
				{
					id: 'id-2',
					name: 'name-2',
					owner: {
						name: 'owner-2',
						content: '{"foo":"bar"}'
					}
				}
			]);

			try {
				const res = await (
					await fetch('http://localhost:9091/bmoor/synthetic/team-info')
				).json();

				expect(res).to.deep.equal({
					result: [
						{
							id: 'id-1',
							name: 'name-1',
							owner: {
								name: 'owner-1',
								content: {
									foo: 'bar'
								}
							}
						},
						{
							id: 'id-2',
							name: 'name-2',
							owner: {
								name: 'owner-2',
								content: {
									foo: 'bar'
								}
							}
						}
					]
				});
				// console.log('args =>', args);
			} catch (ex) {
				console.log('ex', ex);

				throw ex;
			}
		});

		it('should allow for a model to be queried via GET', async function () {
			instance1.localStub.resolves([
				{
					id: 'id-1',
					name: 'name-1',
					owner: {
						name: 'owner-1',
						content: '{"foo":"bar"}'
					}
				},
				{
					id: 'id-2',
					name: 'name-2',
					owner: {
						name: 'owner-2',
						content: '{"foo":"bar"}'
					}
				}
			]);

			try {
				const res = await (
					await fetch(
						'http://localhost:9091/bmoor/querier/document/team-info?query=' +
							encodeURIComponent('$team.id=123')
					)
				).json();

				expect(res).to.deep.equal({
					result: [
						{
							id: 'id-1',
							name: 'name-1',
							owner: {
								name: 'owner-1',
								content: {
									foo: 'bar'
								}
							}
						},
						{
							id: 'id-2',
							name: 'name-2',
							owner: {
								name: 'owner-2',
								content: {
									foo: 'bar'
								}
							}
						}
					]
				});
				// console.log('args =>', args);
			} catch (ex) {
				console.log('ex', ex);

				throw ex;
			}
		});

		it('should allow for a model to be queried via POST', async function () {
			instance1.localStub.resolves([
				{
					id: 'id-1',
					name: 'name-1',
					owner: {
						name: 'owner-1',
						content: '{"foo":"bar"}'
					}
				},
				{
					id: 'id-2',
					name: 'name-2',
					owner: {
						name: 'owner-2',
						content: '{"foo":"bar"}'
					}
				}
			]);

			try {
				const res = await (
					await fetch(
						'http://localhost:9091/bmoor/querier?' +
							`query=${encodeURIComponent('$team.id=123')}`,
						{
							method: 'POST',
							headers: {'Content-Type': 'application/json'},
							body: JSON.stringify({
								base: 'team',
								joins: ['.userId > $user'],
								fields: {
									id: '.id',
									name: '.name',
									owner: {
										name: '$user.name',
										content: '$user.content'
									}
								}
							})
						}
					)
				).json();

				expect(res).to.deep.equal({
					result: [
						{
							id: 'id-1',
							name: 'name-1',
							owner: {
								name: 'owner-1',
								content: {
									foo: 'bar'
								}
							}
						},
						{
							id: 'id-2',
							name: 'name-2',
							owner: {
								name: 'owner-2',
								content: {
									foo: 'bar'
								}
							}
						}
					]
				});
				// console.log('args =>', args);
			} catch (ex) {
				console.log('ex', ex);

				throw ex;
			}
		});
	});

	xdescribe('instance-2 validation', function () {
		console.log('TODO', instance2);
	});
});
