const {expect} = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');

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
				http: () => ({
					execute: httpStub
				})
			}),
			sources: new Config({
				local: new ConfigObject({
					connector: 'local'
				}),
				other: new ConfigObject({
					connector: 'http'
				})
			}),
			directories: new Config({
				// do not load any directories
			})
		}
	);

	cfg = config.override(
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
	let app1 = null;
	let app2 = null;
	let server1 = null;
	let server2 = null;
	let bootstrap1 = null;
	let bootstrap2 = null;

	beforeEach(async function () {
		const app1 = express();

		app1.use(bodyParser.urlencoded({extended: false}));
		app1.use(bodyParser.json());

		const bootstrap1 = buildBootstrap(app1, {
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
						read: 'can-read'
					}
				}
			]
		});

		const app2 = express();

		app2.use(bodyParser.urlencoded({extended: false}));
		app2.use(bodyParser.json());
		const bootstrap2 = buildBootstrap(app2, {
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
						read: 'can-read'
					}
				}
			]
		});

		return Promise.all([
			new Promise((resolve) => {
				server1 = app1.listen(9001, resolve);
			}),
			new Promise((resolve) => {
				server2 = app1.listen(9002, resolve);
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

	it('should work', function(){

	});
});
