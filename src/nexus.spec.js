
const {expect} = require('chai');

describe('src/nexus.js', function(){
	const {Nexus} = require('./nexus.js');

	let nexus = null;

	beforeEach(function(){
		nexus = new Nexus();
	});

	describe('::setModel', function(){
		it('should properly define a model', async function(){
			const model = await nexus.setModel('test-10', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					zwei: true,
					drei: false,
					fier: {
						create: true,
						read: true,
						update: false
					},
					funf: {
						create: true,
						read: true,
						update: false,
						index: true
					}
				}
			});

			expect(model.properties.create)
			.to.deep.equal([
				'zwei',
				'fier',
				'funf'
			]);
		});
	});

	describe('::loadModel', function(){
		it('should resolve after model is defined', async function(){
			let model = null;

			const holder = nexus.loadModel('test-11')
			.then(m => {
				model = m;
			});

			nexus.setModel('test-11', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					zwei: true,
					drei: false,
					fier: {
						create: true,
						read: true,
						update: false
					},
					funf: {
						create: true,
						read: true,
						update: false,
						index: true
					}
				}
			});

			expect(model)
			.to.be.an('null');

			await holder;

			expect(model)
			.not.to.be.an('null');
		});

		it('should resolve if the model was already defined', async function(){
			nexus.setModel('test-12', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					zwei: true,
					drei: false,
					fier: {
						create: true,
						read: true,
						update: false
					},
					funf: {
						create: true,
						read: true,
						update: false,
						index: true
					}
				}
			});

			const model = await nexus.loadModel('test-12');

			expect(model.properties.create)
			.to.deep.equal([
				'zwei',
				'fier',
				'funf'
			]);
		});
	});

	describe('::installService', function(){
		let service = null;

		const connector = {
			prepare: () => Promise.resolve('foo-bar'),
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		describe('model defined first', function(){
			beforeEach(async function(){
				nexus.setModel('test-13', {
					fields: {
						eins: {
							create: false,
							read: true,
							update: false,
							delete: true,
							key: true
						},
						zwei: true,
						drei: false,
						fier: {
							create: true,
							read: true,
							update: false
						},
						funf: {
							create: true,
							read: true,
							update: false,
							index: true
						}
					}
				});

				service = await nexus.installService('test-13', connector);
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}).then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});

		describe('model described second', function(){
			beforeEach(async function(){
				nexus.installService('test-13', connector)
				.then(s => {
					service = s;
				});

				await nexus.setModel('test-13', {
					fields: {
						eins: {
							create: false,
							read: true,
							update: false,
							delete: true,
							key: true
						},
						zwei: true,
						drei: false,
						fier: {
							create: true,
							read: true,
							update: false
						},
						funf: {
							create: true,
							read: true,
							update: false,
							index: true
						}
					}
				});
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}).then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});
	});

	describe('::loadService', function(){
		let service = null;

		const connector = {
			prepare: () => Promise.resolve('foo-bar'),
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		describe('if loaded before installed', function(){
			beforeEach(async function(){
				nexus.setModel('test-14', {
					fields: {
						eins: {
							create: false,
							read: true,
							update: false,
							delete: true,
							key: true
						},
						zwei: true,
						drei: false,
						fier: {
							create: true,
							read: true,
							update: false
						},
						funf: {
							create: true,
							read: true,
							update: false,
							index: true
						}
					}
				});

				const prom = nexus.loadService('test-14');

				await nexus.installService('test-14', connector);

				service = await prom;
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}).then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});

		describe('if loaded after installed', function(){
			beforeEach(async function(){
				nexus.setModel('test-15', {
					fields: {
						eins: {
							create: false,
							read: true,
							update: false,
							delete: true,
							key: true
						},
						zwei: true,
						drei: false,
						fier: {
							create: true,
							read: true,
							update: false
						},
						funf: {
							create: true,
							read: true,
							update: false,
							index: true
						}
					}
				});

				await nexus.installService('test-15', connector);

				service = await nexus.loadService('test-15');
			});

			it('should define the service', async function(){
				await service.create({
					id: 123,
					name: 'name-1',
					title: 'title-1',
					junk: 'junk'
				}).then(res => {
					expect(res).to.deep.equal({
						id: 'something-1',
						value: 'v-1'
					});
				});
			});
		});
	});

	describe('::applyDecorator', function(){
		let service = null;

		const connector = {
			prepare: () => Promise.resolve('foo-bar'),
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		beforeEach(async function(){
			nexus.setModel('test-16', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					zwei: true,
					drei: false,
					fier: {
						create: true,
						read: true,
						update: false
					},
					funf: {
						create: true,
						read: true,
						update: false,
						index: true
					}
				}
			});

			const prom = nexus.loadService('test-16');

			await nexus.installService('test-16', connector);

			service = await prom;
		});

		it('should define the service', async function(){
			await nexus.applyDecorator('test-16', {
				doSomethingCool: async function(info, ctx){
					expect(ctx)
					.to.deep.equal({hello: 'world'});

					return this.create(info);
				}
			});

			await service.doSomethingCool({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk'
			}, {
				hello: 'world'
			}).then(res => {
				expect(res).to.deep.equal({
					id: 'something-1',
					value: 'v-1'
				});
			});
		});
	});

	describe('::applyHook', function(){
		let service = null;

		const connector = {
			prepare: () => Promise.resolve('foo-bar'),
			execute: () => Promise.resolve([{
				id: 'something-1',
				value: 'v-1'
			}])
		};

		beforeEach(async function(){
			nexus.setModel('test-17', {
				fields: {
					eins: {
						create: false,
						read: true,
						update: false,
						delete: true,
						key: true
					},
					zwei: true,
					drei: false,
					fier: {
						create: true,
						read: true,
						update: false
					},
					funf: {
						create: true,
						read: true,
						update: false,
						index: true
					}
				}
			});

			const prom = nexus.loadService('test-17');

			await nexus.installService('test-17', connector);

			service = await prom;
		});

		it('should define the service', async function(){
			const trace = [];

			await nexus.applyHook('test-17', {
				beforeCreate: async function(){
					trace.push(1);
				}
			});

			await service.create({
				id: 123,
				name: 'name-1',
				title: 'title-1',
				junk: 'junk'
			}).then(res => {
				expect(res)
				.to.deep.equal({
					id: 'something-1',
					value: 'v-1'
				});
			});

			expect(trace)
			.to.deep.equal([1]);
		});
	});
});
