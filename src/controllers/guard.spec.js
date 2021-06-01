
const {expect} = require('chai');
const sinon = require('sinon');
const {Config} = require('bmoor/src/lib/config.js');

const {Nexus} = require('../env/nexus.js');
const {Context} = require('../server/context.js');

const sut = require('./guard.js');

describe('src/controller/guard.js', function(){
	let stubs = {};
	let nexus = null;
	let service = null;
	let interface = null;

	beforeEach(async function(){
		stubs = {};
		interface = {};

		const interfaces = new Config({
			stub: function(){
				return interface;
			}
		});
		
		nexus = new Nexus(null, interfaces);

		nexus.configureModel('service-1', {
			connector: 'stub',
			fields: {
				eins: {
					create: false,
					read: true,
					update: false,
					key: true
				},
				zwei: {
					create: false,
					read: false,
					update: false,
					query: true
				},
			}
		});

		stubs.execute = sinon.stub();

		interface = {
			execute: stubs.execute
		};
			
		service = await nexus.configureCrud('service-1', interface);
	});

	afterEach(function(){
		for(let key in stubs){
			if (stubs[key].restore){
				stubs[key].restore();
			}
		}
	});

	describe('::Controller', function(){
		describe('allowing all functionality', function(){
			let controller = null;

			const {Guard} = sut;

			beforeEach(async function(){
				controller = new Guard(service);

				await controller.configure({
					read: true,
					query: true,
					create: true,
					update: true,
					delete: true
				});
			});

			describe('::read', function(){
				it('should call query if query is sent', async function(){
					const content = [{hello: 'world'}];

					stubs.query = sinon.stub(service, 'query')
					.resolves(content);

					const res = await controller.read(
						new Context({
							method: 'get',
							query: {
								param: {
									eins: 'bar',
									zwei: 'foo'
								}
							}
						})
					);

					expect(res)
					.to.deep.equal(content);

					const args = stubs.query.getCall(0).args;
					expect(args[0])
					.to.deep.equal({
						sort: null,
						joins: [],
						position: {
							limit: null
						},
						params: {
							zwei: 'foo'
						}
					});
				});

				it('should call query and properly decode', async function(){
					const content = [{
						hello: 'world',
						eins: 1
					}];

					stubs.execute.resolves(content);

					const res = await controller.read(
						new Context({
							method: 'get',
							query: {
								param: {
									eins: 'bar',
									zwei: 'foo'
								}
							}
						})
					);

					expect(res)
					.to.deep.equal([{
						eins: 1
					}]);

					const args = stubs.execute.getCall(0).args[0];
					expect(args.method)
					.to.deep.equal('read');

					expect(args.query.toJSON())
					.to.deep.equal({
						models: [{
							series: 'service-1',
							schema: 'service-1',
							joins: []
						}],
						fields: [{
							as: 'eins',
							path: 'eins',
							series: 'service-1'
						}],
						params: [{
							series: 'service-1',
							path: 'zwei',
							operation: '=',
							value: 'foo',
							settings: {}
						}]
					});
				});

				it('should call readMany if multiple ids', async function(){
					const content = [{hello: 'world'}];

					stubs.readMany = sinon.stub(service, 'readMany')
					.resolves(content);

					const res = await controller.read(
						new Context({
							method: 'get',
							params: {
								id: '1,2'
							}
						})
					);

					expect(res)
					.to.deep.equal(content);

					const args = stubs.readMany.getCall(0).args;
					expect(args[0])
					.to.deep.equal(['1','2']);
				});

				it('should call read if single id', async function(){
					const content = {hello: 'world'};

					stubs.read = sinon.stub(service, 'read')
					.resolves(content);

					const res = await controller.read(
						new Context({
							method: 'get',
							params: {
								id: '1'
							}
						})
					);

					expect(res)
					.to.deep.equal(content);

					const args = stubs.read.getCall(0).args;
					expect(args[0])
					.to.deep.equal('1');
				});

				it('should fail if call read and no match', async function(){
					let failed = false;
					const content = null;

					stubs.read = sinon.stub(service, 'read')
					.resolves(content);

					try {
						await controller.read(
							new Context({
								method: 'get',
								params: {
									id: '1'
								}
							})
						);
					} catch(ex){
						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_READ_ONE');

						failed = true;
					}

					const args = stubs.read.getCall(0).args;
					expect(args[0])
					.to.deep.equal('1');

					expect(failed)
					.to.equal(true);
				});

				it('should call read if single id and not string', async function(){
					let failed = false;

					const content = [{hello: 'world'}];

					stubs.read = sinon.stub(service, 'read')
					.resolves(content);

					try {
						await controller.read(
							new Context({
								method: 'get',
								params: {
									bad: 'param'
								}
							})
						);
					} catch(ex){
						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_READ_ID');

						failed = true;
					}

					expect(failed)
					.to.equal(true);
				});

				it('should fail if method is not get', async function(){
					let failed = false;

					try {
						await controller.read(
							new Context({
								method: 'not-get'
							})
						);
					} catch(ex){
						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_READ_UNAVAILABLE');

						failed = true;
					}

					expect(failed)
					.to.equal(true);
				});
			});

			describe('::write', function(){
				// test create
				it('should allow post', async function(){
					const content = {hello: 'world'};

					stubs.create = sinon.stub(service, 'create')
					.resolves(content);

					const res = await controller.write(
						new Context({
							method: 'post',
							content: {
								weAre: 'Penn State'
							}
						}, {content: 'content'})
					);

					expect(res)
					.to.deep.equal(content);

					const args = stubs.create.getCall(0).args;
					expect(args[0])
					.to.deep.equal({weAre: 'Penn State'});
				});

				// test update - put
				it('should allow put', async function(){
					const content = {hello: 'world'};

					stubs.create = sinon.stub(service, 'update')
					.resolves(content);

					const res = await controller.write(
						new Context({
							method: 'put',
							body: {
								weAre: 'Penn State'
							},
							params: {
								id: '1'
							}
						}, {content: 'body'})
					);

					expect(res)
					.to.deep.equal(content);

					const args = stubs.create.getCall(0).args;
					expect(args[0])
					.to.deep.equal('1');
					expect(args[1])
					.to.deep.equal({weAre: 'Penn State'});
				});

				it('should allow put with multiple ids', async function(){
					const content = {hello: 'world'};

					stubs.create = sinon.stub(service, 'update')
					.resolves(content);

					const res = await controller.write(
						new Context({
							method: 'put',
							body: {
								weAre: 'Penn State'
							},
							params: {
								id: '1,2'
							}
						})
					);

					expect(res)
					.to.deep.equal([
						content,
						content
					]);

					const args1 = stubs.create.getCall(0).args;
					expect(args1[0])
					.to.deep.equal('1');
					expect(args1[1])
					.to.deep.equal({weAre: 'Penn State'});

					const args2 = stubs.create.getCall(1).args;
					expect(args2[0])
					.to.deep.equal('2');
					expect(args2[1])
					.to.deep.equal({weAre: 'Penn State'});
				});

				it('should fail put if no id is sent', async function(){
					let failed = false;

					try {
						await controller.write(
							new Context({
								method: 'put',
								body: {
									weAre: 'Penn State'
								},
								params: {
								}
							})
						);
					} catch(ex){
						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_PUT_ID');

						failed = true;
					}

					expect(failed)
					.to.equal(true);
				});

				// test update with putIsPatch false
				it('should fail if put and putIsPatch is false', async function(){
					let failed = false;
					sut.config.set('putIsPatch', false);

					try {
						await controller.write(
							new Context({
								method: 'put',
								body: {
									weAre: 'Penn State'
								},
								params: {
									id: '1'
								}
							})
						);
					} catch(ex){
						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_WRITE_NOTREADY');

						failed = true;
					}

					expect(failed)
					.to.equal(true);

					sut.config.set('putIsPatch', true);
				});

				// test update - patch
				it('should allow patch', async function(){
					const content = {hello: 'world'};

					stubs.create = sinon.stub(service, 'update')
					.resolves(content);

					const res = await controller.write(
						new Context({
							method: 'patch',
							body: {
								weAre: 'Penn State'
							},
							params: {
								id: '1'
							}
						})
					);

					expect(res)
					.to.deep.equal(content);

					const args = stubs.create.getCall(0).args;
					expect(args[0])
					.to.deep.equal('1');
					expect(args[1])
					.to.deep.equal({weAre: 'Penn State'});
				});

				it('should allow patch with multiple ids', async function(){
					const content = {hello: 'world'};

					stubs.create = sinon.stub(service, 'update')
					.resolves(content);

					const res = await controller.write(
						new Context({
							method: 'patch',
							body: {
								weAre: 'Penn State'
							},
							params: {
								id: '1,2'
							}
						})
					);

					expect(res)
					.to.deep.equal([
						content,
						content
					]);

					const args1 = stubs.create.getCall(0).args;
					expect(args1[0])
					.to.deep.equal('1');
					expect(args1[1])
					.to.deep.equal({weAre: 'Penn State'});

					const args2 = stubs.create.getCall(1).args;
					expect(args2[0])
					.to.deep.equal('2');
					expect(args2[1])
					.to.deep.equal({weAre: 'Penn State'});
				});

				it('should fail patch if no id is sent', async function(){
					let failed = false;

					try {
						await controller.write(
							new Context({
								method: 'patch',
								body: {
									weAre: 'Penn State'
								},
								params: {
								}
							})
						);
					} catch(ex){
						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_PATCH_ID');

						failed = true;
					}

					expect(failed)
					.to.equal(true);
				});

				// general failure
				it('should fail if method is not post or put', async function(){
					let failed = false;

					try {
						await controller.write(
							new Context({
								method: 'not-get'
							})
						);
					} catch(ex){
						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_WRITE_UNAVAILABLE');

						failed = true;
					}

					expect(failed)
					.to.equal(true);
				});
			});

			describe('::delete', function(){
				// via query
				it('should delete base on query result', async function(){
					const content = {hello: 'world'};

					stubs.query = sinon.stub(service, 'query')
					.resolves([{eins: 1}, {eins: 2}]);

					stubs.delete = sinon.stub(service, 'delete')
					.resolves(content);

					const res = await controller.delete(
						new Context({
							method: 'delete',
							query: {
								param: {
									eins: 'foo',
									zwei: 'bar'
								}
							}
						})
					);

					expect(res)
					.to.deep.equal([
						content,
						content
					]);

					const args = stubs.query.getCall(0).args;
					expect(args[0])
					.to.deep.equal({
						params: {
							zwei: 'bar'
						},
						joins: [],
						sort: null,
						position: {
							limit: null
						}
					});

					const args1 = stubs.delete.getCall(0).args;
					expect(args1[0])
					.to.deep.equal(1);

					const args2 = stubs.delete.getCall(1).args;
					expect(args2[0])
					.to.deep.equal(2);
				});

				// missing id
				it('should fail if no id is supplied', async function(){
					let failed = false;

					const content = {hello: 'world'};

					stubs.delete = sinon.stub(service, 'delete')
					.resolves(content);

					try {
						await controller.delete(
							new Context({
								method: 'delete',
								params: {
								}
							})
						);
					} catch(ex){

						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_DELETE_ID');

						failed = true;
					}

					expect(failed)
					.to.equal(true);
				});

				// with an id
				it('should succeed if id is supplied', async function(){
					const content = {hello: 'world'};
					
					stubs.delete = sinon.stub(service, 'delete')
					.resolves(content);

					await controller.delete(
						new Context({
							method: 'delete',
							params: {
								id: '1'
							}
						})
					);

					const args = stubs.delete.getCall(0).args;
					expect(args[0])
					.to.deep.equal('1');
				});

				// multiple ids
				it('should succeed if multiple id is supplied', async function(){
					const content = {hello: 'world'};
					
					stubs.delete = sinon.stub(service, 'delete')
					.resolves(content);

					await controller.delete(
						new Context({
							method: 'delete',
							params: {
								id: '1,2'
							}
						})
					);

					const args1 = stubs.delete.getCall(0).args;
					expect(args1[0])
					.to.deep.equal('1');

					const args2 = stubs.delete.getCall(1).args;
					expect(args2[0])
					.to.deep.equal('2');
				});

				it('should fail if method is not delete', async function(){
					let failed = false;

					try {
						await controller.delete(
							new Context({
								method: 'not-get'
							})
						);
					} catch(ex){
						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_DELETE_UNAVAILABLE');

						failed = true;
					}

					expect(failed)
					.to.equal(true);
				});
			});
		});

		describe('blocking query functionality', function(){
			let controller = null;

			const {Guard} = sut;

			beforeEach(async function(){
				controller = new Guard(service);

				await controller.configure({
					read: true,
					query: false,
					create: true,
					update: true,
					delete: true
				});
			});

			describe('::read', function(){
				it('should fail if query is requested', async function(){
					let failed = false;
					const content = [{hello: 'world'}];

					stubs.query = sinon.stub(service, 'query')
					.resolves(content);

					try {
						await controller.read(
							new Context({
								method: 'get',
								query: {
									filter: {
										foo: 'bar'
									}
								}
							})
						);
					} catch(ex){
						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_GUARDED');

						failed = true;
					}

					expect(failed)
					.to.equal(true);
				});
			});

			describe('::delete', function(){
				it('should fail if query is requested', async function(){
					let failed = false;
					const content = [{hello: 'world'}];

					stubs.query = sinon.stub(service, 'delete')
					.resolves(content);

					try {
						await controller.delete(
							new Context({
								method: 'delete',
								query: {
									filter: {
										foo: 'bar'
									}
								}
							})
						);
					} catch(ex){
						expect(ex.code)
						.to.equal('CRUD_CONTROLLER_GUARDED');

						failed = true;
					}

					expect(failed)
					.to.equal(true);
				});
			});
		});
		
		describe('blocking base functionality', function(){
			let controller = null;

			const {Guard} = sut;

			beforeEach(async function(){
				controller = new Guard(service);

				await controller.configure({
					read: false,
					query: true,
					create: false,
					update: false,
					delete: false
				});

				describe('::read', function(){
					it('should fail if query is requested', async function(){
						let failed = false;
						const content = [{hello: 'world'}];

						stubs.query = sinon.stub(service, 'read')
						.resolves(content);

						try {
							await controller.read(
								new Context({
									method: 'get',
									param: {
										id: '1'
									}
								})
							);
						} catch(ex){
							expect(ex.code)
							.to.equal('CRUD_CONTROLLER_GUARDED');

							failed = true;
						}

						expect(failed)
						.to.equal(true);
					});
				});

				describe('::write', function(){
					it('should fail put if id is supplied', async function(){
						let failed = false;
						const content = [{hello: 'world'}];

						stubs.query = sinon.stub(service, 'delete')
						.resolves(content);

						try {
							await controller.write(
								new Context({
									method: 'put',
									params: {
										id: '1'
									}
								})
							);
						} catch(ex){
							expect(ex.code)
							.to.equal('CRUD_CONTROLLER_GUARDED');

							failed = true;
						}

						expect(failed)
						.to.equal(true);
					});

					it('should fail post if id is supplied', async function(){
						let failed = false;
						const content = [{hello: 'world'}];

						stubs.query = sinon.stub(service, 'delete')
						.resolves(content);

						try {
							await controller.write(
								new Context({
									method: 'post',
									params: {
										id: '1'
									}
								})
							);
						} catch(ex){
							expect(ex.code)
							.to.equal('CRUD_CONTROLLER_GUARDED');

							failed = true;
						}

						expect(failed)
						.to.equal(true);
					});
				});

				describe('::delete', function(){
					it('should fail if id is supplied', async function(){
						let failed = false;
						const content = [{hello: 'world'}];

						stubs.query = sinon.stub(service, 'delete')
						.resolves(content);

						try {
							await controller.delete(
								new Context({
									method: 'delete',
									params: {
										id: '1'
									}
								})
							);
						} catch(ex){
							expect(ex.code)
							.to.equal('CRUD_CONTROLLER_GUARDED');

							failed = true;
						}

						expect(failed)
						.to.equal(true);
					});
				});
			});
		});
	});
});
