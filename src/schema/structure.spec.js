const {expect} = require('chai');

const {Statement} = require('./statement.js');
const {StatementField} = require('./statement/field.js');

describe('src/schema/structure.js', function(){
	const sut = require('./structure.js');

	let base = null;
	let ctx = null;
	let permissions = null;

	beforeEach(function(){
		ctx = {};
		permissions = {};

		base = new Statement('base-series', 'base-model');
	
		ctx.hasPermission = function(permission){
			return !!permissions[permission];
		};
	});

	describe('::extendStatement', function(){
		it('should work with base settings', async function(){
			const structure = new sut.Structure('base-struct');

			structure.configure({});

			await Promise.all([
				structure.addField('eins', {
					series: 'series-1',
					storagePath: 'path1',
					reference: 'path1'
				}),
				structure.addField('zwei', {
					series: 'series-2',
					storagePath: 'path2',
					reference: 'path2',
					read: true
				}),
				structure.addField('foo.bar', {
					series: 'series-1',
					storagePath: 'path3',
					reference: 'path3',
					read: true
				}),
				structure.addField('hello.world', {
					series: 'series-2',
					storagePath: 'path4',
					reference: 'path4',
					read: true
				})
			]);

			await structure.extendStatement(base, {}, ctx);

			expect(base.toJSON()).to.deep.equal({
			    models: [
			        {
			            series: 'base-series',
			            schema: undefined
			        },
			        {
			            series: 'series-2',
			            schema: 'series-2'
			        },
			        {
			            series: 'series-1',
			            schema: 'series-1'
			        }
			    ],
			    fields: [
			        {
			            series: 'series-2',
			            path: 'path2',
			            as: 'path2'
			        },
			        {
			            series: 'series-2',
			            path: 'path4',
			            as: 'path4'
			        },
			        {
			            series: 'series-1',
			            path: 'path3',
			            as: 'path3'
			        }
			    ],
			    filters: {
			        join: 'and',
			        expressables: []
			    },
			    params: {
			        join: 'and',
			        expressables: []
			    }
			});
		});
	});
});