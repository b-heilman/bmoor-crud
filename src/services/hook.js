
const {asyncWrap} = require('./wrap.js');

function mapFactory(fn, old){
	if (!old){
		return fn;
	} else {
		return async function(ctx){
			const eins = await old(ctx);
			const zwei = await fn(ctx);

			return function(datum){
				return zwei(eins(datum));
			};
		};
	}
}

function filterFactory(fn, old){
	if (!old){
		return fn;
	} else {
		return async function(ctx){
			const eins = await old(ctx);
			const zwei = await fn(ctx);

			return function(datum){
				if (eins(datum)){
					return zwei(datum);
				} else {
					return false;
				}
			};
		};
	}
}

function hook(crud, settings){
	if (settings.beforeCreate){
		crud._beforeCreate = asyncWrap(
			settings.beforeCreate, 
			crud._beforeCreate,
			true
		);
	}

	if (settings.afterCreate){
		crud._afterCreate = asyncWrap(
			settings.afterCreate, 
			crud._afterCreate,
			false
		);
	}

	if (settings.beforeQuery){
		crud._beforeQuery = asyncWrap(
			settings.beforeQuery, 
			crud._beforeQuery,
			true
		);
	}

	if (settings.beforeUpdate){
		crud._beforeUpdate = asyncWrap(
			settings.beforeUpdate, 
			crud._beforeUpdate,
			true
		);
	}

	if (settings.afterUpdate){
		crud._afterUpdate = asyncWrap(
			settings.afterUpdate, 
			crud._afterUpdate,
			false
		);
	}

	if (settings.beforeDelete){
		crud._beforeDelete = asyncWrap(
			settings.beforeDelete, 
			crud._beforeDelete,
			true
		);
	}

	if (settings.afterDelete){
		crud._afterDelete = asyncWrap(
			settings.afterDelete, 
			crud._afterDelete,
			false
		);
	}

	if (settings.mapFactory){
		crud._mapFactory = mapFactory(
			settings.mapFactory,
			crud._mapFactory
		);
	}

	if (settings.filterFactory){
		crud._filterFactory = filterFactory(
			settings.filterFactory,
			crud._filterFactory
		);
	}
}

module.exports = {
	hook
};
