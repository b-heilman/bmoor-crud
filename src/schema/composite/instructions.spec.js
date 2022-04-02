const expect = require('chai').expect;

const {Instructions} = require('./instructions.js');

describe('src/schema/composite/instructions.js', function () {
	it('should work for a single join', function () {
		const ci = new Instructions({
			base: 'm-1',
			alias: null,
			joins: ['$m-1 > $m-2 > .myId$m-3'],
			fields: {
				field1: '$m-1.field',
				field2: '$m-2.field',
				field3: '$m-3.field'
			}
		});

		expect(ci.index).to.deep.equal({
			'm-1': {
				series: 'm-1',
				model: 'm-1',
				isNeeded: true,
				optional: false,
				incoming: [],
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
				isNeeded: true,
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
				isNeeded: true,
				join: {}
			}
		});

		expect(ci.fields).to.deep.equal([
			{
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
				statement: '$m-1.field'
			},
			{
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
				statement: '$m-2.field'
			},
			{
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
				statement: '$m-3.field'
			}
		]);

		expect(ci.subs).to.deep.equal([]);
	});

	it('should work with an alias', function () {
		const ci = new Instructions({
			base: 'm-1',
			joins: [
				'$m-1 > $alias-2:m-2 > #alias:sub-1',
				'$alias-2:m-2 > #alias-3:sub-1'
			],
			fields: {
				field1: '$m-1.field',
				field2: '$alias-2.field',
				field3: {
					value: '#alias'
				},
				alias: '#alias-3'
			}
		});

		expect(ci.index).to.deep.equal({
			'm-1': {
				series: 'm-1',
				isNeeded: true,
				model: 'm-1',
				optional: false,
				incoming: [],
				join: {
					'alias-2': {
						from: null,
						to: null
					}
				}
			},
			'alias-2': {
				series: 'alias-2',
				isNeeded: true,
				model: 'm-2',
				optional: false,
				incoming: ['m-1'],
				join: {
					alias: {
						from: null,
						to: null
					},
					'alias-3': {
						from: null,
						to: null
					}
				}
			},
			alias: {
				series: 'alias',
				isNeeded: false,
				composite: 'sub-1',
				incoming: ['alias-2'],
				optional: false
			},
			'alias-3': {
				series: 'alias-3',
				isNeeded: false,
				composite: 'sub-1',
				incoming: ['alias-2'],
				optional: false
			}
		});

		expect(ci.fields).to.deep.equal([
			{
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
				statement: '$m-1.field'
			},
			{
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
				statement: '$alias-2.field'
			}
		]);

		expect(ci.subs).to.deep.equal([
			{
				type: 'include',
				isArray: false,
				path: 'field3.value',
				action: {
					loader: 'include',
					model: undefined,
					field: null,
					target: null,
					optional: false,
					series: 'alias'
				},
				statement: '#alias'
			},
			{
				type: 'include',
				isArray: false,
				path: 'alias',
				action: {
					loader: 'include',
					model: undefined,
					field: null,
					target: null,
					optional: false,
					series: 'alias-3'
				},
				statement: '#alias-3'
			}
		]);
	});

	it('should work with optional fields', function () {
		const ci = new Instructions({
			base: 'm-1',
			joins: ['$m-1 >? $m-2 > $alias:m-3'],
			fields: {
				field1: '$m-1.field',
				field2: '$m-2.field',
				field3: '$alias.field'
			}
		});

		expect(ci.index).to.deep.equal({
			'm-1': {
				model: 'm-1',
				series: 'm-1',
				isNeeded: true,
				optional: false,
				incoming: [],
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
				isNeeded: true,
				optional: true,
				incoming: ['m-1'],
				join: {
					alias: {
						from: null,
						to: null
					}
				}
			},
			alias: {
				model: 'm-3',
				series: 'alias',
				isNeeded: true,
				optional: true,
				incoming: ['m-2'],
				join: {}
			}
		});

		expect(ci.fields).to.deep.equal([
			{
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
				statement: '$m-1.field'
			},
			{
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
				statement: '$m-2.field'
			},
			{
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
				statement: '$alias.field'
			}
		]);
	});

	it('should work with a sub', function () {
		const ci = new Instructions({
			base: 'm-1',
			joins: ['$m-1 > $m-2 > #doc'],
			fields: {
				field1: '$m-1.field',
				field2: '$m-2.field',
				field3: ['#doc']
			}
		});

		expect(ci.index).to.deep.equal({
			'm-1': {
				model: 'm-1',
				series: 'm-1',
				isNeeded: true,
				optional: false,
				incoming: [],
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
				isNeeded: true,
				optional: false,
				incoming: ['m-1'],
				join: {
					doc: {
						from: null,
						to: null
					}
				}
			},
			doc: {
				composite: 'doc',
				series: 'doc',
				isNeeded: false,
				optional: false,
				incoming: ['m-2']
			}
		});

		expect(ci.fields).to.deep.equal([
			{
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
				statement: '$m-1.field'
			},
			{
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
				statement: '$m-2.field'
			}
		]);

		expect(ci.subs).to.deep.equal([
			{
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
				statement: '#doc'
			}
		]);

		expect(
			ci.getTrace('doc').map((doc) => ({
				series: doc.series,
				incoming: doc.incoming
			}))
		).to.deep.equal([
			{series: 'm-1', incoming: []},
			{series: 'm-2', incoming: ['m-1']},
			{series: 'doc', incoming: ['m-2']}
		]);
	});

	it('should work with optional fields', function () {
		// Note white space testing as well
		const ci = new Instructions({
			base: 'm-1',
			joins: ['$m-1 >? $m-2 > $alias:m-3', ' > $m-4 > $m-5', '> $m-6 > $m-5'],
			fields: {
				field1: ' .field',
				field2: '$m-2.field',
				field3: '$alias.field',
				field4: '$m-5.field'
			}
		});

		expect(ci.index).to.deep.equal({
			'm-1': {
				model: 'm-1',
				series: 'm-1',
				isNeeded: true,
				optional: false,
				incoming: [],
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
				isNeeded: true,
				optional: true,
				incoming: ['m-1'],
				join: {
					alias: {
						from: null,
						to: null
					}
				}
			},
			alias: {
				model: 'm-3',
				series: 'alias',
				isNeeded: true,
				optional: true,
				incoming: ['m-2'],
				join: {}
			},
			'm-4': {
				model: 'm-4',
				series: 'm-4',
				isNeeded: true,
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
				isNeeded: true,
				optional: false,
				incoming: ['m-4', 'm-6'],
				join: {}
			},
			'm-6': {
				model: 'm-6',
				series: 'm-6',
				isNeeded: true,
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

	it('should correctly trace a path', function () {
		const ci = new Instructions({
			base: 'm-1',
			joins: ['> $m-2 > $m-3', '> $m-20 > $m-21 > $m-3'],
			fields: {
				field3: '$m-3.field'
			}
		});

		expect(ci.getTrace('m-3').map((r) => r.series)).to.deep.equal([
			'm-1',
			'm-20',
			'm-21',
			'm-2',
			'm-3'
		]);

		expect(ci.getTrace('m-21').map((r) => r.series)).to.deep.equal([
			'm-1',
			'm-20',
			'm-21'
		]);
	});

	it('should correctly find the mount path', function () {
		const ci = new Instructions({
			base: 'm-1',
			joins: [
				'> $m-2 > $m-3',
				'> $m-20 > $m-21 > $m-3',
				'> $m-20 > $m-10 > $m-11'
			],
			fields: {
				field2: '$m-2.field',
				field3: '$m-3.field',
				field20: '$m-20.field'
			}
		});

		expect(ci.getMount('m-3').map((r) => r.series)).to.deep.equal(['m-3']);

		// check for duplication bug
		expect(ci.getMount('m-3').map((r) => r.series)).to.deep.equal(['m-3']);

		// it's a central mount point, so it's needed due to m-3
		expect(ci.getMount('m-21').map((r) => r.series)).to.deep.equal(['m-21']);

		expect(ci.getMount('m-11').map((r) => r.series)).to.deep.equal([
			'm-20',
			'm-10',
			'm-11'
		]);
	});

	describe('::extend', function () {
		it('should correctly extend another', function () {
			const ci1 = new Instructions({
				base: 'm-1',
				joins: ['$m-1 >? $m-2 > $m-3', '> $m-4 > $m-5', '> $m-6 > $m-5'],
				fields: {
					field3: '$m-3.field'
				}
			});

			const ci2 = new Instructions({
				base: 'm-10',
				joins: ['$m-10 > $m-6'],
				fields: {
					field10: '$m-10.field',
					field6: '$m-6.field'
				}
			});

			ci2.extend(ci1);

			expect(ci2.index).to.deep.equal({
				'm-10': {
					model: 'm-10',
					series: 'm-10',
					isNeeded: true,
					optional: false,
					incoming: [],
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
					isNeeded: true,
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
					isNeeded: true,
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
					isNeeded: true,
					optional: true,
					incoming: ['m-2'],
					join: {}
				},
				'm-4': {
					model: 'm-4',
					series: 'm-4',
					isNeeded: false,
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
					isNeeded: true,
					optional: false,
					incoming: ['m-10', 'm-1'],
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
					isNeeded: false,
					optional: false,
					incoming: ['m-4', 'm-6'],
					join: {}
				}
			});

			expect(ci2.fields).to.deep.equal([
				{
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
					statement: '$m-10.field'
				},
				{
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
					statement: '$m-6.field'
				},
				{
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
					statement: '$m-3.field'
				}
			]);
		});
	});

	describe('::inline', function () {
		it('should correctly line another', function () {
			const ci1 = new Instructions({
				base: 'm-1',
				joins: ['$m-1 > $m-2 > $m-3', '$m-1 > #sub-1'],
				fields: {
					field3: '$m-3.field',
					sub1: '#sub-1'
				}
			});

			const ci2 = new Instructions({
				base: 'm-10',
				joins: ['$m-10 > $m-6'],
				fields: {
					field10: '$m-10.field',
					field6: '$m-6.field'
				}
			});

			ci1.inline('sub-1', ci2);

			expect(ci1.index).to.deep.equal({
				'm-1': {
					model: 'm-1',
					series: 'm-1',
					isNeeded: true,
					optional: false,
					incoming: [],
					join: {
						'm-2': {
							from: null,
							to: null
						},
						'sub-1m-10': {
							from: null,
							to: null
						}
					}
				},
				'm-2': {
					model: 'm-2',
					series: 'm-2',
					isNeeded: true,
					optional: false,
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
					isNeeded: true,
					optional: false,
					incoming: ['m-2'],
					join: {}
				},
				'sub-1m-10': {
					model: 'm-10',
					series: 'sub-1m-10',
					isNeeded: true,
					optional: false,
					incoming: ['m-1'],
					join: {
						'sub-1m-6': {
							from: null,
							to: null
						}
					}
				},
				'sub-1m-6': {
					model: 'm-6',
					series: 'sub-1m-6',
					isNeeded: true,
					optional: false,
					incoming: ['sub-1m-10'],
					join: {}
				}
			});

			expect(ci1.fields).to.deep.equal([
				{
					type: 'access',
					action: {
						loader: 'access',
						model: 'm-3',
						field: 'field',
						target: null,
						optional: false,
						series: 'm-3'
					},
					statement: '$m-3.field',
					path: 'field3',
					isArray: false
				},
				{
					type: 'access',
					action: {
						loader: 'access',
						model: 'm-10',
						field: 'field',
						target: null,
						optional: false,
						series: 'sub-1m-10'
					},
					statement: '$m-10.field',
					path: 'sub1.field10',
					isArray: false
				},
				{
					type: 'access',
					action: {
						loader: 'access',
						model: 'm-6',
						field: 'field',
						target: null,
						optional: false,
						series: 'sub-1m-6'
					},
					statement: '$m-6.field',
					path: 'sub1.field6',
					isArray: false
				}
			]);
		});

		it('should correctly inline multiple levels', function () {
			const ci1 = new Instructions({
				base: 'm-1',
				joins: ['$m-1 > $m-2 > $m-3', '$m-1 > $m-4'],
				fields: {
					field3: '$m-3.field',
					field4: '$m-4.field'
				}
			});

			const ci2 = new Instructions({
				base: 'm-10',
				joins: ['$m-10 > $m-16', '$m-10 > #sub-1'],
				fields: {
					field10: '$m-10.field',
					field16: '$m-16.field',
					sub1: '#sub-1'
				}
			});

			const ci3 = new Instructions({
				base: 'm-20',
				joins: ['> #sub-2'],
				fields: {
					field20: '$m-20.field',
					sub2: '#sub-2'
				}
			});

			ci3.inline('sub-2', ci2);

			expect(ci3.index).to.deep.equal({
				'm-20': {
					series: 'm-20',
					model: 'm-20',
					isNeeded: true,
					optional: false,
					incoming: [],
					join: {
						'sub-2m-10': {
							from: null,
							to: null
						}
					}
				},
				'sub-2m-10': {
					model: 'm-10',
					series: 'sub-2m-10',
					isNeeded: true,
					optional: false,
					incoming: ['m-20'],
					join: {
						'sub-2m-16': {
							from: null,
							to: null
						},
						'sub-2sub-1': {
							from: null,
							to: null
						}
					}
				},
				'sub-2m-16': {
					series: 'sub-2m-16',
					model: 'm-16',
					isNeeded: true,
					optional: false,
					incoming: ['sub-2m-10'],
					join: {}
				},
				'sub-2sub-1': {
					series: 'sub-2sub-1',
					composite: 'sub-1',
					isNeeded: false,
					optional: false,
					incoming: ['sub-2m-10']
				}
			});

			ci3.inline('sub-2sub-1', ci1);

			expect(ci3.index).to.deep.equal({
				'm-20': {
					series: 'm-20',
					model: 'm-20',
					isNeeded: true,
					optional: false,
					incoming: [],
					join: {
						'sub-2m-10': {
							from: null,
							to: null
						}
					}
				},
				'sub-2m-10': {
					model: 'm-10',
					series: 'sub-2m-10',
					isNeeded: true,
					optional: false,
					incoming: ['m-20'],
					join: {
						'sub-2m-16': {
							from: null,
							to: null
						},
						'sub-2sub-1m-1': {
							from: null,
							to: null
						}
					}
				},
				'sub-2m-16': {
					model: 'm-16',
					series: 'sub-2m-16',
					isNeeded: true,
					optional: false,
					incoming: ['sub-2m-10'],
					join: {}
				},
				'sub-2sub-1m-1': {
					model: 'm-1',
					series: 'sub-2sub-1m-1',
					isNeeded: true,
					optional: false,
					incoming: ['sub-2m-10'],
					join: {
						'sub-2sub-1m-2': {
							from: null,
							to: null
						},
						'sub-2sub-1m-4': {
							from: null,
							to: null
						}
					}
				},
				'sub-2sub-1m-2': {
					model: 'm-2',
					series: 'sub-2sub-1m-2',
					isNeeded: true,
					optional: false,
					incoming: ['sub-2sub-1m-1'],
					join: {
						'sub-2sub-1m-3': {
							from: null,
							to: null
						}
					}
				},
				'sub-2sub-1m-3': {
					model: 'm-3',
					series: 'sub-2sub-1m-3',
					isNeeded: true,
					optional: false,
					incoming: ['sub-2sub-1m-2'],
					join: {}
				},
				'sub-2sub-1m-4': {
					model: 'm-4',
					series: 'sub-2sub-1m-4',
					isNeeded: true,
					optional: false,
					incoming: ['sub-2sub-1m-1'],
					join: {}
				}
			});

			expect(ci3.fields).to.deep.equal([
				{
					type: 'access',
					action: {
						loader: 'access',
						model: 'm-20',
						field: 'field',
						target: null,
						optional: false,
						series: 'm-20'
					},
					statement: '$m-20.field',
					path: 'field20',
					isArray: false
				},
				{
					type: 'access',
					action: {
						loader: 'access',
						model: 'm-10',
						field: 'field',
						target: null,
						optional: false,
						series: 'sub-2m-10'
					},
					statement: '$m-10.field',
					path: 'sub2.field10',
					isArray: false
				},
				{
					type: 'access',
					action: {
						loader: 'access',
						model: 'm-16',
						field: 'field',
						target: null,
						optional: false,
						series: 'sub-2m-16'
					},
					statement: '$m-16.field',
					path: 'sub2.field16',
					isArray: false
				},
				{
					type: 'access',
					action: {
						loader: 'access',
						model: 'm-3',
						field: 'field',
						target: null,
						optional: false,
						series: 'sub-2sub-1m-3'
					},
					statement: '$m-3.field',
					path: 'sub2.sub1.field3',
					isArray: false
				},
				{
					type: 'access',
					action: {
						loader: 'access',
						model: 'm-4',
						field: 'field',
						target: null,
						optional: false,
						series: 'sub-2sub-1m-4'
					},
					statement: '$m-4.field',
					path: 'sub2.sub1.field4',
					isArray: false
				}
			]);
		});
	});
});
