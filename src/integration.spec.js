/*const {expect} = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');*/

const {Bootstrap, config} = require('./index.js');

async function buildBootstrap1(){
	const localStub = sinon.stub(); 
	const cfg = config.override(
		{},
		{
			connectors: new Config({
				local: () => ({
					execute: localStub
				})
			}),
			sources: new Config({
				'local': new ConfigObject({
					connector: 'local'
				})
			}),
			directories: new Config({
				// do not load any directories
			})
		}
	);

	bootstrap = new Bootstrap(cfg);

	const mockery = {
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
	};

	await bootstrap.install(mockery);

	return {
		bootstrap,
		localStub
	};
}

async function buildBootstrap2(){
	const localStub = sinon.stub(); 
	const httpStub = sinon.stub();

	const cfg = config.override(
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
				'local': new ConfigObject({
					connector: 'local'
				}),
				'other': new ConfigObject({
					connector: 'http'
				})
			}),
			directories: new Config({
				// do not load any directories
			})
		}
	);

	bootstrap = new Bootstrap(cfg);

	const mockery = {
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
	};

	await bootstrap.install(mockery);

	return {
		bootstrap,
		stub
	};
}

describe('integration tests', function () {
	/***
	 * First server, responds with data
	 ***/
	

});
