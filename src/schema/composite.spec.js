
const expect = require('chai').expect;

const {Nexus} = require('../env/nexus.js');
const {config} = require('./structure.js');
const {Composite, CompositeInstructions} = require('./composite.js');

describe('src/schema/composite.js', function(){
	describe('CompositeInstructions', function(){
		it('should work for a single join', function(){
			const ci = new CompositeInstructions('m-1', [
				'$m-1 > $m-2 > .myId$m-3'
			], {
				field1: '$m-1.field',
				field2: '$m-2.field',
				field3: '$m-3.field'
			});

			expect(ci.index)
			.to.deep.equal({
				'm-1': {
					series: 'm-1',
					model: 'm-1',
					structural: false,
					join: {
						'm-2': {
							from: null,
							to: null
						}
					}
				},
				'm-2': {
					series: 'm-2',
					model: 'm-2',
					optional: false,
					incoming: ['m-1'],
					structural: false,
					join: {
						'm-3': {
							from: null,
							to: 'myId'
						}
					}
				},
				'm-3': {
					series: 'm-3',
					model: 'm-3',
					optional: false,
					incoming: ['m-2'],
					structural: false,
					join: {}
				}
			});

			expect(ci.fields)
			.to.deep.equal([{
				type: 'access',
				isArray: false,
				path: 'field1',
				action: {
					loader: 'access',
					model: 'm-1',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-1'
				},
				statement: '$m-1.field',
				mountPoint: 'field1'
			}, {
				type: 'access',
				isArray: false,
				path: 'field2',
				action: {
					loader: 'access',
					model: 'm-2',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-2'
				},
				statement: '$m-2.field',
				mountPoint: 'field2'
			}, {
				type: 'access',
				isArray: false,
				path: 'field3',
				action: {
					loader: 'access',
					model: 'm-3',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-3'
				},
				statement: '$m-3.field',
				mountPoint: 'field3'
			}]);

			expect(ci.subs)
			.to.deep.equal([]);
		});

		it('should work with an alias', function(){
			const ci = new CompositeInstructions('m-1', [
				'$m-1 > $alias-2:m-2 > $alias:m-3'
			], {
				field1: '$m-1.field',
				field2: '$alias-2.field',
				field3: {
					value: '$alias.field'
				}
			});

			expect(ci.index)
			.to.deep.equal({
				'm-1': {
					series: 'm-1',
					structural: false,
					model: 'm-1',
					join: {
						'alias-2': {
							from: null,
							to: null
						}
					}
				},
				'alias-2': {
					series: 'alias-2',
					structural: false,
					model: 'm-2',
					optional: false,
					incoming: ['m-1'],
					join: {
						'alias': {
							from: null,
							to: null
						}
					}
				},
				'alias': {
					series: 'alias',
					structural: false,
					model: 'm-3',
					incoming: ['alias-2'],
					optional: false,
					join: {}
				}
			});

			expect(ci.fields)
			.to.deep.equal([{
				type: 'access',
				isArray: false,
				path: 'field1',
				action: {
					loader: 'access',
					model: 'm-1',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-1'
				},
				statement: '$m-1.field',
				mountPoint: 'field1'
			}, {
				type: 'access',
				isArray: false,
				path: 'field2',
				action: {
					loader: 'access',
					model: 'm-2',
					field: 'field',
					target: null,
					optional: false,
					series: 'alias-2'
				},
				statement: '$alias-2.field',
				mountPoint: 'field2'
			}, {
				type: 'access',
				isArray: false,
				path: 'field3.value',
				action: {
					loader: 'access',
					model: 'm-3',
					field: 'field',
					target: null,
					optional: false,
					series: 'alias'
				},
				statement: '$alias.field',
				mountPoint: 'field3.value'
			}]);
		});

		it('should work with optional fields', function(){
			const ci = new CompositeInstructions('m-1', [
				'$m-1 >? $m-2 > $alias:m-3'
			], {
				field1: '$m-1.field',
				field2: '$m-2.field',
				field3: '$alias.field'
			});

			expect(ci.index)
			.to.deep.equal({
				'm-1': {
					model: 'm-1',
					series: 'm-1',
					structural: false,
					join: {
						'm-2': {
							from: null,
							to: null
						}
					}
				},
				'm-2': {
					model: 'm-2',
					series: 'm-2',
					structural: false,
					optional: true,
					incoming: ['m-1'],
					join: {
						'alias': {
							from: null,
							to: null
						}
					}
				},
				'alias': {
					model: 'm-3',
					series: 'alias',
					structural: false,
					optional: true,
					incoming: ['m-2'],
					join: {}
				}
			});

			expect(ci.fields)
			.to.deep.equal([{
				type: 'access',
				isArray: false,
				path: 'field1',
				action: {
					loader: 'access',
					model: 'm-1',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-1'
				},
				statement: '$m-1.field',
				mountPoint: 'field1'
			}, {
				type: 'access',
				isArray: false,
				path: 'field2',
				action: {
					loader: 'access',
					model: 'm-2',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-2'
				},
				statement: '$m-2.field',
				mountPoint: 'field2'
			}, {
				type: 'access',
				isArray: false,
				path: 'field3',
				action: {
					loader: 'access',
					model: 'm-3',
					field: 'field',
					target: null,
					optional: false,
					series: 'alias'
				},
				statement: '$alias.field',
				mountPoint: 'field3'
			}]);
		});

		it('should work with a sub', function(){
			const ci = new CompositeInstructions('m-1', [
				'$m-1 > $m-2 > #doc'
			], {
				field1: '$m-1.field',
				field2: '$m-2.field',
				field3: ['#doc']
			});

			expect(ci.index)
			.to.deep.equal({
				'm-1': {
					model: 'm-1',
					series: 'm-1',
					structural: false,
					join: {
						'm-2': {
							from: null,
							to: null
						}
					}
				},
				'm-2': {
					model: 'm-2',
					series: 'm-2',
					structural: false,
					optional: false,
					incoming: ['m-1'],
					join: {
						'doc': {
							from: null,
							to: null
						}
					}
				},
				'doc': {
					composite: 'doc',
					series: 'doc',
					structural: false,
					optional: false,
					incoming: ['m-2']
				}
			});

			expect(ci.fields)
			.to.deep.equal([{
				type: 'access',
				isArray: false,
				path: 'field1',
				action: {
					loader: 'access',
					model: 'm-1',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-1'
				},
				statement: '$m-1.field',
				mountPoint: 'field1'
			}, {
				type: 'access',
				isArray: false,
				path: 'field2',
				action: {
					loader: 'access',
					model: 'm-2',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-2'
				},
				statement: '$m-2.field',
				mountPoint: 'field2'
			}]);

			expect(ci.subs)
			.to.deep.equal([{
				type: 'include',
				isArray: true,
				path: 'field3',
				action: {
					loader: 'include',
					model: undefined,
					field: null,
					target: null,
					optional: false,
					series: 'doc'
				},
				statement: '#doc',
				mountPoint: 'field3[0]'
			}]);

			expect(ci.getTrace('doc').map(
				doc => ({
					series: doc.series,
					incoming: doc.incoming
				})
			)).to.deep.equal([
				{series: 'm-1', incoming: undefined},
				{series:'m-2', incoming: ['m-1']},
				{series:'doc', incoming: ['m-2']}
			]);
		});

		it('should work with optional fields', function(){
			// Note white space testing as well
			const ci = new CompositeInstructions('m-1', [
				'$m-1 >? $m-2 > $alias:m-3',
				' > $m-4 > $m-5',
				'> $m-6 > $m-5'
			], {
				field1: ' .field',
				field2: '$m-2.field',
				field3: '$alias.field',
				field4: '$m-5.field'
			});

			expect(ci.index)
			.to.deep.equal({
				'm-1': {
					model: 'm-1',
					series: 'm-1',
					structural: false,
					join: {
						'm-2': {
							from: null,
							to: null
						},
						'm-4': {
							from: null,
							to: null
						},
						'm-6': {
							from: null,
							to: null
						}
					}
				},
				'm-2': {
					model: 'm-2',
					series: 'm-2',
					structural: false,
					optional: true,
					incoming: ['m-1'],
					join: {
						'alias': {
							from: null,
							to: null
						}
					}
				},
				'alias': {
					model: 'm-3',
					series: 'alias',
					structural: false,
					optional: true,
					incoming: ['m-2'],
					join: {}
				},
				'm-4': {
					model: 'm-4',
					series: 'm-4',
					structural: true,
					optional: false,
					incoming: ['m-1'],
					join: {
						'm-5': {
							from: null,
							to: null
						}
					}
				},
				'm-5': {
					model: 'm-5',
					series: 'm-5',
					structural: false,
					optional: false,
					incoming: ['m-4', 'm-6'],
					join: {}
				},
				'm-6': {
					model: 'm-6',
					series: 'm-6',
					structural: true,
					optional: false,
					incoming: ['m-1'],
					join: {
						'm-5': {
							from: null,
							to: null
						}
					}
				}
			});
		});

		it('should correctly extend another', function(){
			const ci1 = new CompositeInstructions('m-1', [
				'$m-1 >? $m-2 > $m-3',
				'> $m-4 > $m-5',
				'> $m-6 > $m-5'
			], {
				field3: '$m-3.field'
			});

			const ci2 = new CompositeInstructions('m-10', [
				'$m-10 > $m-6'
			], {
				field10: '$m-10.field',
				field6: '$m-6.field'
			});

			ci2.extend(ci1);

			expect(ci2.index)
			.to.deep.equal({
				'm-10': {
					model: 'm-10',
					series: 'm-10',
					structural: false,
					join: {
						'm-6': {
							from: null,
							to: null
						},
						'm-1': {
							from: null,
							to: null
						}
					}
				},
				'm-1': {
					model: 'm-1',
					series: 'm-1',
					structural: true,
					optional: false,
					incoming: ['m-10'],
					join: {
						'm-2': {
							from: null,
							to: null
						},
						'm-4': {
							from: null,
							to: null
						},
						'm-6': {
							from: null,
							to: null
						}
					}
				},
				'm-2': {
					model: 'm-2',
					series: 'm-2',
					structural: true,
					optional: true,
					incoming: ['m-1'],
					join: {
						'm-3': {
							from: null,
							to: null
						}
					}
				},
				'm-3': {
					model: 'm-3',
					series: 'm-3',
					structural: false,
					optional: true,
					incoming: ['m-2'],
					join: {}
				},
				'm-4': {
					model: 'm-4',
					series: 'm-4',
					structural: true,
					optional: false,
					incoming: ['m-1'],
					join: {
						'm-5': {
							from: null,
							to: null
						}
					}
				},
				'm-6': {
					model: 'm-6',
					series: 'm-6',
					structural: false,
					optional: false,
					incoming: ['m-10','m-1'],
					join: {
						'm-5': {
							from: null,
							to: null
						}
					}
				},
				'm-5': {
					model: 'm-5',
					series: 'm-5',
					structural: true,
					optional: false,
					incoming: ['m-4', 'm-6'],
					join: {}
				}
			});

			expect(ci2.fields)
			.to.deep.equal([{
				type: 'access',
				isArray: false,
				path: 'field10',
				action: {
					loader: 'access',
					model: 'm-10',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-10'
				},
				statement: '$m-10.field',
				mountPoint: 'field10'
			}, {
				type: 'access',
				isArray: false,
				path: 'field6',
				action: {
					loader: 'access',
					model: 'm-6',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-6'
				},
				statement: '$m-6.field',
				mountPoint: 'field6'
			}, {
				type: 'access',
				isArray: false,
				path: 'field3',
				action: {
					loader: 'access',
					model: 'm-3',
					field: 'field',
					target: null,
					optional: false,
					series: 'm-3'
				},
				statement: '$m-3.field',
				mountPoint: 'field3'
			}]);
		});

		it('should correctly trace a path', function(){
			const ci = new CompositeInstructions('m-1', [
				'> $m-2 > $m-3',
				'> $m-20 > $m-21 > $m-3'
			], {
				field3: '$m-3.field'
			});

			expect(ci.getTrace('m-3').map(r => r.series))
			.to.deep.equal([
				'm-1',
				'm-20',
				'm-21',
				'm-2',
				'm-3'
			]);

			expect(ci.getTrace('m-21').map(r => r.series))
			.to.deep.equal([
				'm-1',
				'm-20',
				'm-21'
			]);
		});

		it('should correctly find the mount path', function(){
			const ci = new CompositeInstructions('m-1', [
				'> $m-2 > $m-3',
				'> $m-20 > $m-21 > $m-3'
			], {
				field2: '$m-2.field',
				field3: '$m-3.field',
				field20: '$m-20.field'
			});

			expect(ci.getMount('m-3').map(r => r.series))
			.to.deep.equal([
				'm-20',
				'm-21',
				'm-2',
				'm-3'
			]);

			// check for duplication bug
			expect(ci.getMount('m-3').map(r => r.series))
			.to.deep.equal([
				'm-20',
				'm-21',
				'm-2',
				'm-3'
			]);

			expect(ci.getMount('m-21').map(r => r.series))
			.to.deep.equal([
				'm-20',
				'm-21'
			]);
		});
	});

	describe('Composite', function(){
		let nexus = null;

		beforeEach(async function(){
			nexus = new Nexus();

			await nexus.configureModel('test-1', {
				fields: {
					id: {
						read: true,
						key: true
					},
					name: {
						read: true
					},
					json: {
						usage: 'json'
					},
					title: {
						read: true
					}
				}
			});

			await nexus.configureModel('test-2', {
				schema: 'table_2',
				fields: {
					id: {
						read: true,
						key: true
					},
					name: {
						read: true
					},
					title: {
						read: true
					},
					json: {
						usage: 'json'
					},
					test1Id: {
						read: true,
						link: {
							name: 'test-1',
							field: 'id'
						}
					}
				}
			});

			await nexus.configureModel('test-3', {
				isFlat: true,
				fields: {
					id: {
						read: true,
						key: true
					},
					name: {
						read: true
					},
					title: {
						read: true
					},
					test2Id: {
						read: true,
						link: {
							name: 'test-2',
							field: 'id'
						}
					}
				}
			});

			await nexus.configureModel('test-pivot', {
				fields: {
					id: {
						read: true
					},
					test3Id: {
						read: true,
						link: {
							name: 'test-3',
							field: 'id'
						}
					},
					test4Id: {
						read: true,
						link: {
							name: 'test-4',
							field: 'id'
						}
					}
				}
			});

			await nexus.configureModel('test-4', {
				isFlat: false,
				fields: {
					id: {
						read: true,
						key: true
					},
					name: {
						read: true
					},
					title: {
						read: true
					}
				}
			});

			await nexus.configureModel('test-5', {
				fields: {
					id: {
						read: true,
						key: true
					},
					name: {
						read: true
					},
					title: {
						read: true
					},
					owner1Id: {
						read: true,
						link: {
							name: 'test-1',
							field: 'id'
						}
					},
					creator1Id: {
						read: true,
						link: {
							name: 'test-1',
							field: 'id'
						}
					}
				}
			});

			await nexus.configureModel('test-6', {
				fields: {
					table5Id: {
						read: true,
						link: {
							name: 'test-5',
							field: 'id'
						}
					}
				}
			});
		});

		describe('::configure', function(){
			it('should run correctly', async function(){
				await (new Composite('foo-bar-1', nexus)).configure({
					base: 'test-1',
					joins: [
						'> $test-2'
					],
					fields: {
						name: '.name',
						version: '$test-2.name'
					}
				});
			});

			describe('via nexus', function(){
				it('should allow a child composite', async function(){
					await nexus.configureComposite('foo-bar-1', {
						base: 'test-1',
						joins: [
							'> $test-2'
						],
						fields: {
							name: '.name',
							version: '$test-2.name'
						}
					});

					await nexus.configureComposite('foo-bar-2', {
						base: 'test-3',
						joins: [
							'> $test-2 > #foo-bar-1'
						],
						fields: {
							name: '.name',
							version: '#foo-bar-1'
						}
					});
				});

				it('should allow a child composite, from same base', async function(){
					await nexus.configureComposite('foo-bar-1', {
						base: 'test-1',
						joins: [
							'> $test-2'
						],
						fields: {
							name: '.name',
							version: '$test-2.name'
						}
					});

					await nexus.configureComposite('foo-bar-2', {
						base: 'test-1',
						joins: [
							'> #foo-bar-1'
						],
						fields: {
							json: '.json',
							other: '#foo-bar-1'
						}
					});
				});
			});
		});

		describe('::getChangeType', function(){
			let sut = null;

			beforeEach(async function(){
				await nexus.configureModel('test-10', {
					fields: {
						eins: {
							update: false
						},
						zwei: {
							update: true,
							updateType: config.get('changeTypes.major')
						},
						drei: {
							update: true,
							updateType: config.get('changeTypes.minor')
						},
						fier: {
							update: true,
							updateType: config.get('changeTypes.major')
						}
					}
				});

				await nexus.configureModel('test-11', {
					fields: {
						eins: {
							update: false
						},
						zwei: {
							update: true,
							updateType: config.get('changeTypes.major')
						},
						drei: {
							update: true,
							updateType: config.get('changeTypes.minor')
						},
						link: {
							read: true,
							link: {
								name: 'test-10',
								field: 'eins'
							}
						}
					}
				});

				sut = new Composite('foo-bar-1', nexus);
				await sut.configure({
					base: 'test-10',
					joins: [
						'> $test-11'
					],
					fields: {
						eins: '.eins',
						zwei: '.zwei',
						drei: '.drei',
						fier: '.fier',
						eins2: '$test-11.eins',
						other: {
							zwei: '$test-11.zwei'
						},
						drei2: '$test-11.drei'
					}
				});
			});

			it('pull in a singlar value', async function(){
				expect(
					sut.getChangeType({
						zwei: 2,
						drei: 3
					})
				).to.equal(config.get('changeTypes.major'));

				expect(
					sut.getChangeType({
						other: {
							zwei: 2
						},
						drei2: 3
					})
				).to.equal(config.get('changeTypes.major'));

				expect(
					sut.getChangeType({
						eins: 1,
						drei: 3
					})
				).to.equal(config.get('changeTypes.minor'));

				expect(
					sut.getChangeType({
						eins2: 1,
						drei2: 3
					})
				).to.equal(config.get('changeTypes.minor'));

				expect(
					sut.getChangeType({
						zwei: 2
					})
				).to.equal(config.get('changeTypes.major'));

				expect(
					sut.getChangeType({
						other: {
							zwei: 2
						}
					})
				).to.equal(config.get('changeTypes.major'));

				expect(
					sut.getChangeType({
						eins: 1,
						eins2: 1
					})
				).to.equal(config.get('changeTypes.none'));

				expect(
					sut.getChangeType({
						foo: 'bar'
					})
				).to.equal(config.get('changeTypes.none'));
			});
		});

		describe('::validate', function(){
			let sut = true;

			const createMode = config.get('writeModes.create');
			const updateMode = config.get('writeModes.update');

			beforeEach(async function(){
				await nexus.configureModel('test-10', {
					fields: {
						eins: {
							update: false
						},
						zwei: {
							update: true,
							validation: {
								required: true
							}
						}
					}
				});

				await nexus.configureModel('test-11', {
					fields: {
						eins: {
							update: false
						},
						zwei: {
							update: true,
							validation: {
								required: true
							}
						},
						link: {
							read: true,
							link: {
								name: 'test-10',
								field: 'eins'
							}
						}
					}
				});

				sut = new Composite('foo-bar-1', nexus);
				await sut.configure({
					base: 'test-10',
					joins: [
						'> $test-11'
					],
					fields: {
						eins: '.eins',
						zwei: '.zwei',
						eins2: '$test-11.eins',
						other: {
							zwei: '$test-11.zwei'
						}
					}
				});
			});

			it('should work on create', async function(){
				expect(
					sut.validate({
						eins: 1,
						zwei: 2,
						eins2: 1,
						other: {
							zwei: 3
						}
					}, createMode)
				).to.deep.equal([]);

				expect(
					sut.validate({
						eins: 1,
						fier: 4
					}, createMode)
				).to.deep.equal([
					{path: 'zwei', message: 'can not be empty'},
					{path: 'other.zwei', message: 'can not be empty'}
				]);

				expect(
					sut.validate({
						eins: 1,
						zwei: 2
					}, createMode)
				).to.deep.equal([
					{path: 'other.zwei', message: 'can not be empty'}
				]);
			});

			it('should work on update', async function(){
				expect(
					sut.validate({
						eins: 1, 
						zwei: 2, 
						other: {
							zwei: 2
						}
					}, updateMode)
				).to.deep.equal([]);

				expect(
					sut.validate({
						eins: 1, 
						eins2: 1
					}, updateMode)
				).to.deep.equal([]);

				expect(
					sut.validate({
						eins: 1, 
						zwei: null, 
						other: {
							zwei: null
						}
					}, updateMode)
				).to.deep.equal([
					{path: 'zwei', message: 'can not be empty'},
					{path: 'other.zwei', message: 'can not be empty'}
				]);
			});
		});

		describe('::getQuery', function(){
			// TODO: run this against models that have alias schemas
			it('should work', async function(){
				const lookup = new Composite('foo-bar', nexus);

				await nexus.configureModel('my-model', {
					schema: 'a_schema',
					fields: {
						id: {
							key: true,
							read: true
						},
						name: {
							read: true
						},
						test1Id: {
							read: true,
							link: {
								name: 'test-1',
								field: 'id'
							}
						}
					}
				});

				await nexus.configureModel('my-tail', {
					schema: 'tail_schema',
					fields: {
						id: {
							key: true,
							read: true
						},
						name: {
							read: true
						}
					}
				});

				await nexus.configureModel('my-pivot', {
					schema: 'pivot_schema',
					fields: {
						id: {
							key: true,
							read: true
						},
						name: {
							read: true
						},
						test1Id: {
							read: true,
							link: {
								name: 'test-1',
								field: 'id'
							}
						},
						myTailId: {
							read: true,
							link: {
								name: 'my-tail',
								field: 'id'
							}
						}
					}
				});

				await lookup.configure({
					base: 'test-1',
					joins: [
						'> $test-2 > $test-3',
						'> $my-model',
						'> $my-pivot > $my-tail'
					],
					fields: {
						eins: '.name',
						zwei: '$test-2.name',
						drei: '$test-2.title',
						fier: '$test-3.name',
						aliased: '$my-model.name',
						pivot: '$my-pivot.name',
						tail: '$my-tail.name'
					}
				});

				const query = await lookup.getQuery({
					params: {
						'$test-1.name': 'foo-bar',
						'$test-3.name': {
							'eq': 'hello-world'
						}
					}
				});

				expect(query.toJSON())
				.to.deep.equal({
					models: [{
						series: 'test-1',
						schema: 'test-1',
						joins: []
					}, {
						series: 'test-2',
						schema: 'table_2',
						joins: [{
							name: 'test-1',
							optional: false,
							mappings: [{
								from: 'test1Id',
								to: 'id'
							}]
						}]
					}, {
						series: 'my-model',
						schema: 'a_schema',
						joins: [{
							name: 'test-1',
							optional: false,
							mappings: [{
								from: 'test1Id',
								to: 'id'
							}]
						}]
					}, {
						series: 'my-pivot',
						schema: 'pivot_schema',
						joins: [{
							name: 'test-1',
							optional: false,
							mappings: [{
								from: 'test1Id',
								to: 'id'
							}]
						}]
					}, {
						series: 'test-3',
						schema: 'test-3',
						joins: [{
							name: 'test-2',
							optional: false,
							mappings: [{
								from: 'test2Id',
								to: 'id'
							}]
						}]
					}, {
						series: 'my-tail',
						schema: 'tail_schema',
						joins: [{
							name: 'my-pivot',
							optional: false,
							mappings: [{
								to: 'myTailId',
								from: 'id'
							}]
						}]
					}],
					fields: [{
						series: 'test-1',
						as: 'eins',
						path: 'name'
					}, {
						series: 'test-2',
						as: 'zwei',
						path: 'name'
					}, {
						series: 'test-2',
						as: 'drei',
						path: 'title'
					}, {
						series: 'my-model',
						as: 'aliased',
						path: 'name'
					}, {
						series: 'my-pivot',
						as: 'pivot',
						path: 'name'
					}, {
						series: 'test-3',
						as: 'fier',
						path: 'name'
					}, {
						series: 'my-tail',
						as: 'tail',
						path: 'name'
					}],
					params: [{
						series: 'test-1',
						path: 'name',
						operation: '=',
						value: 'foo-bar',
						settings: {}
					},{
						series: 'test-3',
						path: 'name',
						operation: 'eq',
						value: 'hello-world',
						settings: {}
					}]
				});
			});

			it('should succeed with a basic alignment', async function(){
				const lookup = new Composite('foo-bar', nexus);

				await lookup.configure({
					base: 'test-1',
					joins: [
						'> $test-2 > $test-3'
					],
					fields: {
						eins: '.name',
						zwei: '$test-2.name',
						drei: '$test-2.title',
						fier: '$test-3.name'
					}
				});

				const query = await lookup.getQuery();

				expect(query.toJSON())
				.to.deep.equal({
					models: [{
						series: 'test-1',
						schema: 'test-1',
						joins: []
					}, {
						series: 'test-2',
						schema: 'table_2',
						joins: [{
							name: 'test-1',
							optional: false,
							mappings: [{
								from: 'test1Id',
								to: 'id'
							}]
						}]
					}, {
						series: 'test-3',
						schema: 'test-3',
						joins: [{
							name: 'test-2',
							optional: false,
							mappings: [{
								from: 'test2Id',
								to: 'id'
							}]
						}]
					}],
					fields: [{
						series: 'test-1',
						as: 'eins',
						path: 'name'
					}, {
						series: 'test-2',
						as: 'zwei',
						path: 'name'
					}, {
						series: 'test-2',
						as: 'drei',
						path: 'title'
					}, {
						series: 'test-3',
						as: 'fier',
						path: 'name'
					}],
					params: []
				});
			});

			it('should succeed with a alias alignment', async function(){
				const lookup = new Composite('foo-bar', nexus);

				await lookup.configure({
					base: 'test-5',
					joins: [
						'.creator1Id > $creator:test-1',
						'.owner1Id > ?$owner:test-1'
					],
					fields: {
						eins: '$creator.name',
						zwei: '$creator.title',
						drei: '.title',
						fier: '$owner.name',
						funf: '$owner.title'
					}
				});
				
				const query = await lookup.getQuery({
					joins: [
						'$junk:test-6 > .id$test-5'
					],
					params: {
						'$creator.id': 123,
						'$junk.foo': {
							gt: 456,
							lt: 789
						}
					}
				});

				expect(query.toJSON())
				.to.deep.equal({
					models: [{
						series: 'test-5',
						schema: 'test-5',
						joins: []
					}, {
						series: 'creator',
						schema: 'test-1',
						joins: [{
							name: 'test-5',
							optional: false,
							mappings: [{
								from: 'id',
								to: 'creator1Id'
							}]
						}]
					}, {
						series: 'owner',
						schema: 'test-1',
						joins: [{
							name: 'test-5',
							optional: true,
							mappings: [{
								from: 'id',
								to: 'owner1Id'
							}]
						}]
					}, {
						series: 'junk',
						schema: 'test-6',
						joins: [{
							name: 'test-5',
							optional: false,
							mappings: [{
								from: 'table5Id',
								to: 'id'
							}]
						}]
					}],
					fields: [{
						series: 'test-5',
						as: 'drei',
						path: 'title'
					}, {
						series: 'creator',
						as: 'eins',
						path: 'name'
					}, {
						series: 'creator',
						as: 'zwei',
						path: 'title'
					}, {
						series: 'owner',
						as: 'fier',
						path: 'name'
					}, {
						series: 'owner',
						as: 'funf',
						path: 'title'
					}],
					params: [{
						series: 'creator',
						path: 'id',
						operation: '=',
						value: 123,
						settings: {}
					}, {
						series: 'junk',
						path: 'foo',
						operation: 'gt',
						value: 456,
						settings: {}
					}, {
						series: 'junk',
						path: 'foo',
						operation: 'lt',
						value: 789,
						settings: {}
					}]
				});
			});
		});

		describe('::calculateDynamics', function(){
			it('should work', async function(){
				const lookup = new Composite('foo-bar', nexus);

				await lookup.configure({
					base: 'test-1',
					joins: [
						'> $test-2 > $test-3'
					],
					fields: {
						eins: '$test-1.name',
						zwei: '$test-2.name',
						drei: '$test-2.title',
						fier: '$test-3.name'
					},
					dynamics: {
						foo: function(datum, variables){
							return variables.one + variables.two;
						},
						hello: {
							world: function(datum){
								return datum.eins+':'+datum.zwei;
							}
						}
					}
				});

				const datum = {
					eins: 'eins',
					zwei: 'zwei'
				};

				lookup.calculateDynamics(datum, {one: 1, two: 2});

				expect(datum)
				.to.deep.equal({
					eins: 'eins',
					zwei: 'zwei',
					foo: 3,
					hello: {
						world: 'eins:zwei'
					}
				});
			});
		});

		describe('::encodeResults', function(){
			it('should work', async function(){
				const lookup = new Composite('foo-bar', nexus);

				await lookup.configure({
					base: 'test-1',
					joins: [],
					fields: {
						eins: '.name'
					},
					encode: function(){
						return 'ok';
					}
				});

				expect(await lookup.encodeResults({one: 1, two: 2}))
				.to.deep.equal('ok');
			});

			it('should correctly default', async function(){
				const lookup = new Composite('foo-bar', nexus);

				await lookup.configure({
					base: 'test-1',
					joins: [],
					fields: {
						eins: '.name'
					}
				});

				expect(await lookup.encodeResults({one: 1, two: 2}))
				.to.deep.equal({one: 1, two: 2});
			});

			it('should correctly stack', async function(){
				await nexus.configureComposite('foo-bar-1', {
					base: 'test-1',
					joins: ['> $test-2'],
					fields: {
						name: '.name',
						version: '$test-2.name'
					},
					encode: function(datum){
						expect(datum)
						.to.deep.equal({hello: 'world'});

						datum.foo = 'bar';

						return datum;
					}
				});

				const lookup = await nexus.configureComposite('foo-bar-2', {
					base: 'test-1',
					extends: 'foo-bar-1',
					joins: ['> #foo-bar-1'],
					fields: {
						json: '.json',
						other: '#foo-bar-1'
					},
					encode: function(datum){
						expect(datum)
						.to.deep.equal({hello: 'world', foo: 'bar'});

						datum.eins = 'zwei';

						return datum;
					}
				});

				expect(await lookup.encodeResults({hello: 'world'}))
				.to.deep.equal({hello: 'world', foo: 'bar', eins: 'zwei'});
			});
		});

		describe('::getKeyQueryByModel', function(){
			it('should work', async function(){
				const lookup = new Composite('foo-bar', nexus);

				await lookup.configure({
					base: 'test-1',
					joins: [
						'> $test-2 > $test-3'
					],
					fields: {
						eins: '$test-1.name',
						zwei: '$test-2.name',
						drei: '$test-2.title',
						fier: '$test-3.name'
					}
				});

				let query = await lookup.getKeyQueryByModel('test-1', 1, {});

				expect(query.toJSON())
				.to.deep.equal({
					models: [{
						series: 'test-1',
						schema: 'test-1',
						joins: []
					}],
					fields: [{
						series: 'test-1',
						as: 'key',
						path: 'id'
					}],
					params: [{
						series: 'test-1',
						path: 'id',
						operation: '=',
						value: 1,
						settings: {}
					}]
				});

				query = await lookup.getKeyQueryByModel('test-2', 2, {});

				expect(query.toJSON())
				.to.deep.equal({
					models: [{
						series: 'test-1',
						schema: 'test-1',
						joins: []
					}, {
						series: 'test-2',
						schema: 'table_2',
						joins: [{
							name: 'test-1',
							optional: false,
							mappings: [{
								from: 'test1Id',
								to: 'id'
							}]
						}]
					}],
					fields: [{
						series: 'test-1',
						as: 'key',
						path: 'id'
					}],
					params: [{
						series: 'test-2',
						path: 'id',
						operation: '=',
						value: 2,
						settings: {}
					}]
				});

				query = await lookup.getKeyQueryByModel('test-3', 3, {});

				expect(query.toJSON())
				.to.deep.equal({
					models: [{
						series: 'test-1',
						schema: 'test-1',
						joins: []
					}, {
						series: 'test-2',
						schema: 'table_2',
						joins: [{
							name: 'test-1',
							optional: false,
							mappings: [{
								to: 'id',
								from: 'test1Id'
							}]
						}]
					}, {
						series: 'test-3',
						schema: 'test-3',
						joins: [{
							name: 'test-2',
							optional: false,
							mappings: [{
								to: 'id',
								from: 'test2Id'
							}]
						}]
					}],
					fields: [{
						series: 'test-1',
						as: 'key',
						path: 'id'
					}],
					params: [{
						series: 'test-3',
						path: 'id',
						operation: '=',
						value: 3,
						settings: {}
					}]
				});
			});

			it('should succeed with a alias alignment', async function(){
				const lookup = new Composite('foo-bar', nexus);

				await lookup.configure({
					base: 'test-5',
					joins: [
						'.creator1Id > $creator:test-1',
						'.owner1Id > ?$owner:test-1'
					],
					fields: {
						eins: '$creator.name',
						zwei: '$creator.title',
						drei: '$test-5.title',
						fier: '$owner.name',
						funf: '$owner.title'
					}
				});
				
				let query = await lookup.getKeyQueryByModel('test-1', 123);

				expect(query.toJSON())
				.to.deep.equal({
					models: [{
						series: 'test-5',
						schema: 'test-5',
						joins: []
					}, {
						series: 'owner',
						schema: 'test-1',
						joins: [{
							name: 'test-5',
							optional: true,
							mappings: [{
								from: 'id',
								to: 'owner1Id'
							}]
						}]
					}, {
						series: 'creator',
						schema: 'test-1',
						joins: [{
							name: 'test-5',
							optional: false,
							mappings: [{
								from: 'id',
								to: 'creator1Id'
							}]
						}]
					}],
					fields: [{
						series: 'test-5',
						as: 'key',
						path: 'id'
					}],
					params: [{
						series: 'owner',
						path: 'id',
						operation: '=',
						value: 123,
						settings: {}
					}, {
						series: 'creator',
						path: 'id',
						operation: '=',
						value: 123,
						settings: {}
					}]
				});
			});
		});

		describe('::getKeyQueryBySeries', function(){
			it('should work', async function(){
				const sub = new Composite('sub', nexus);

				await sub.configure({
					base: 'test-4',
					joins: [],
					fields: {
						eins: '.name',
						title: '.title'
					}
				});

				nexus.loadComposite = async function(name){
					expect(name)
					.to.equal('sub');

					return sub;
				};

				const lookup = new Composite('foo-bar', nexus);

				await lookup.configure({
					base: 'test-1',
					joins: [
						'> $test-2 > $test-3 > $test-pivot > #sub'
					],
					fields: {
						eins: '.name',
						title: '.title',
						zwei: '$test-2.name',
						subs: ['#sub']
					}
				});

				let query = await lookup.getKeyQueryBySeries(
					'sub', 3, {}
				);

				expect(query.toJSON())
				.to.deep.equal({
					models: [
						{
							'series': 'test-1',
							'schema': 'test-1',
							'joins': []
						},
						{
							'series': 'test-2',
							'schema': 'table_2',
							'joins': [
								{
									'name': 'test-1',
									'mappings': [
										{
											'from': 'test1Id',
											'to': 'id'
										}
									],
									'optional': false
								}
							]
						},
						{
							'series': 'test-3',
							'schema': 'test-3',
							'joins': [
								{
									'name': 'test-2',
									'mappings': [
										{
											'from': 'test2Id',
											'to': 'id'
										}
									],
									'optional': false
								}
							]
						},
						{
							'series': 'test-pivot',
							'schema': 'test-pivot',
							'joins': [
								{
									'name': 'test-3',
									'mappings': [
										{
											'from': 'test3Id',
											'to': 'id'
										}
									],
									'optional': false
								}
							]
						},
						{
							'series': 'sub',
							'schema': 'test-4',
							'joins': [
								{
									'name': 'test-pivot',
									'mappings': [
										{
											'from': 'id',
											'to': 'test4Id'
										}
									],
									'optional': false
								}
							]
						}
					],
					fields: [
						{
							'series': 'test-1',
							'path': 'id',
							'as': 'key'
						}
					],
					params: [
						{
							'series': 'sub',
							'path': 'id',
							'operation': '=',
							'value': 3,
							'settings': {}
						}
					]
				});
			});
		});

		describe('::getInflater', function(){
			it('should work', async function(){
				const lookup = new Composite('blah', nexus);

				await lookup.configure({
					base: 'test-1',
					joins: ['> $test-2 > $test-3'],
					fields: {
						eins: '.name',
						zwei: '$test-2.name',
						drei: '$test-2.title',
						fier: '$test-3.name'
					}
				});

				const inflate = await lookup.getInflater({});

				const datum = inflate({
					'eins': 'field-1',
					'zwei': 'field-2',
					'drei': 'field-3',
					'fier': 'field-4'
				});

				expect(datum)
				.to.deep.equal({
					eins: 'field-1',
					zwei: 'field-2',
					drei: 'field-3',
					fier: 'field-4'
				});
			});

			it('should work with types and isFlat', async function(){
				const lookup = new Composite('blah', nexus);

				await lookup.configure({
					base: 'test-1',
					joins: ['> $test-2 > $test-3'],
					fields: {
						eins: '.json',
						zwei: '$test-2.json',
						drei: '$test-2.title',
						fier: {
							value: '$test-3.name'
						}
					}
				});

				const inflate = await lookup.getInflater({});

				const datum = inflate({
					'eins': '{"foo":"bar"}',
					'zwei': '{"hello":"world"}',
					'drei': 'field-3',
					'fier.value': 'field-4'
				});

				expect(datum)
				.to.deep.equal({
					eins: {
						foo: 'bar'
					},
					zwei: {
						hello: 'world'
					},
					drei: 'field-3',
					fier: {
						value: 'field-4'
					}
				});
			});

			it('should work with types and isFlat:false', async function(){
				const lookup = new Composite('blah', nexus);

				await lookup.configure({
					base: 'test-1',
					joins: ['> $test-2 > $test-3'],
					fields: {
						eins: '.json',
						zwei: '$test-2.json',
						drei: {
							value: '$test-2.title'
						},
						fier: '$test-3.name'
					}
				});

				const inflate = await lookup.getInflater({});

				const datum = inflate({
					'eins': '{"foo":"bar"}',
					'zwei': '{"hello":"world"}',
					'drei': {
						value: 'field-3'
					},
					'fier': 'field-4'
				});

				expect(datum)
				.to.deep.equal({
					eins: {
						foo: 'bar'
					},
					zwei: {
						hello: 'world'
					},
					drei: {
						value: 'field-3'
					},
					fier: 'field-4'
				});
			});
		});

		describe('schema', function(){
			it('should define the correct properties', async function(){
				const comp = new Composite('test', nexus);

				await comp.configure({
					base: 'test-2',
					joins: [],
					fields: {
						name: '.name',
						foo: {
							bar: '.title'
						}
					}
				});

				await comp.link();

				const test = comp.fields.map(
					field => field.toJSON()
				);

				expect(test)
				.to.deep.equal([{
					path: 'name',
					storage: {
						schema: 'test-2',
						path: 'name'
					},
					usage: {
						type: undefined,
						description: undefined
					}
				}, {
					path: 'foo.bar',
					storage: {
						schema: 'test-2',
						path: 'title'
					},
					usage: {
						type: undefined,
						description: undefined
					}
				}]);
			});

			describe('extends', function(){
				it('should pull in all the extended fields', async function(){
					await nexus.configureComposite('base', {
						base: 'test-1',
						joins: [],
						fields: {
							name: '.name'
						}
					});

					const comp = new Composite('extends', nexus);

					await comp.configure({
						base: 'test-2',
						extends: 'base',
						joins: [],
						fields: {
							myName: '.name'
						}
					});

					await comp.link();

					const test = comp.fields.map(
						field => field.toJSON()
					);

					expect(test)
					.to.deep.equal([{
						path: 'myName',
						storage: {
							schema: 'test-2',
							path: 'name'
						},
						usage: {
							type: undefined,
							description: undefined
						}
					}, {
						path: 'name',
						storage: {
							schema: 'test-1',
							path: 'name'
						},
						usage: {
							type: undefined,
							description: undefined
						}
					}]);
				});

				it('should be able to extend an extension', async function(){
					await nexus.configureComposite('base', {
						base: 'test-1',
						joins: [],
						fields: {
							name: '.name'
						}
					});

					await nexus.configureComposite('extends', {
						base: 'test-2',
						extends: 'base',
						joins: [],
						fields: {
							myName: '.name'
						}
					});

					const comp = new Composite('uber-extends', nexus);

					await comp.configure({
						base: 'test-3',
						extends: 'extends',
						joins: [],
						fields: {
							reallyMyName: '.name'
						}
					});

					await comp.link();

					const test = comp.fields.map(
						field => field.toJSON()
					);

					expect(test)
					.to.deep.equal([{
						path: 'reallyMyName',
						storage: {
							schema: 'test-3',
							path: 'name'
						},
						usage: {
							type: undefined,
							description: undefined
						}
					},{
						path: 'myName',
						storage: {
							schema: 'test-2',
							path: 'name'
						},
						usage: {
							type: undefined,
							description: undefined
						}
					}, {
						path: 'name',
						storage: {
							schema: 'test-1',
							path: 'name'
						},
						usage: {
							type: undefined,
							description: undefined
						}
					}]);
				});
			});
		});
	});
});
