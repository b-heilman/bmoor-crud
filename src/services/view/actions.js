const {del} = require('bmoor/src/core.js');

const {buildTransformer} = require('../../schema/structure/actions.js');


function stackMethods(...ops){
	return ops.reduce(
		(oldFn, fn) => {
			if (fn){
				if (oldFn){
					return function(datum, ctx){
						return fn(oldFn(datum, ctx), ctx);
					};
				} else {
					return fn
				}
			} else {
				return oldFn;
			}
		},
		null
	);
}

class ViewActions {
	constructor(fields, structureActions) {
		// TODO: now that I have things separated, do I really want this 
		//   logic here?
		/***
		 * Here's how permissions / security will work.  I am going to treat
		 * the framework like a red/green network topography.  Everything
		 * services and schemas will be assumed sanitized, and controllers
		 * will sanitize any incoming things.  This reduces the number of 
		 * unneccisary copies made of data. So cleanFor are used to apply permissions
		 * to a known data shape and copyFor is to sanitize data from the outside.
		 * 
		 * Deflate will act as a copyFor, so I don't need one for create or update
		 ***/
		// create => cleanForCreate => deflate
		this.deflateCreate = stackMethods(
			structureActions.deflate,
			structureActions.create,
			structureActions.convertFromCreate
		);

		// source read => cleanForInflate => inflate
		this.inflate = stackMethods(
			structureActions.convertFromStorage,
			structureActions.inflate
		);

		// update => cleanForUpdate => deflate
		this.deflateUpdate = stackMethods(
			structureActions.deflate,
			structureActions.update,
			structureActions.convertFromUpdate
		);

		this.cleanForIndex = fields.reduce(
			buildTransformer('index', 'externalGetter', 'externalSetter'),
			function(){
				return {};
			}
		);

		this.cleanForQuery = fields.reduce(
			buildTransformer('query', 'externalGetter', 'externalSetter'),
			function(){
				return {};
			}
		);
	}
}

module.exports = {
	ViewActions
};
