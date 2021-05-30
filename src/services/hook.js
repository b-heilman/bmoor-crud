
function asyncWrap(fn, old, before = true){
	if (before){
		if (old){
			return async function(datum, ctx, self){
				await fn(datum, ctx, self);

				return old(datum, ctx, self);
			};
		} else {
			return fn;
		}
	} else {
		if (old){
			return async function(datum, ctx, self){
				await old(datum, ctx, self);

				return fn(datum, ctx, self);
			};
		} else {
			return fn;
		}
	}
}

function boolWrap(fn, old){
	if (old){
		return async function(datum, ctx, self){
			if (await fn(datum, ctx, self)){
				return old(datum, ctx, self);
			} else {
				return false;
			}
		};
	} else {
		return fn;
	}
}

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
		crud.hooks.beforeCreate = asyncWrap(
			settings.beforeCreate, 
			crud.hooks.beforeCreate,
			true
		);
	}

	if (settings.afterCreate){
		crud.hooks.afterCreate = asyncWrap(
			settings.afterCreate, 
			crud.hooks.afterCreate,
			false
		);
	}

	if (settings.beforeQuery){
		crud.hooks.beforeQuery = asyncWrap(
			settings.beforeQuery, 
			crud.hooks.beforeQuery,
			true
		);
	}

	if (settings.beforeUpdate){
		crud.hooks.beforeUpdate = asyncWrap(
			settings.beforeUpdate, 
			crud.hooks.beforeUpdate,
			true
		);
	}

	if (settings.afterUpdate){
		crud.hooks.afterUpdate = asyncWrap(
			settings.afterUpdate, 
			crud.hooks.afterUpdate,
			false
		);
	}

	if (settings.beforeDelete){
		crud.hooks.beforeDelete = asyncWrap(
			settings.beforeDelete, 
			crud.hooks.beforeDelete,
			true
		);
	}

	if (settings.afterDelete){
		crud.hooks.afterDelete = asyncWrap(
			settings.afterDelete, 
			crud.hooks.afterDelete,
			false
		);
	}

	//------------
	// TODO: move these to 'security'
	if (settings.canCreate){
		crud.hooks.canCreate = boolWrap(
			settings.canCreate, 
			crud.hooks.canCreate
		);
	}

	// .....canAccess....
	if (settings.canRead){
		// Idea is that different models can chain this.  I can be accessed if a 
		// higher model can access me.
		// event-version-section -> event-version -> event
		// TODO: to support, need to cache reads/write/update
		crud.hooks.canRead = boolWrap(
			settings.canRead, 
			crud.hooks.canRead
		);
	}

	if (settings.canUpdate){
		crud.hooks.canUpdate = boolWrap(
			settings.canUpdate, 
			crud.hooks.canUpdate
		);
	}

	if (settings.canDelete){
		crud.hooks.canDelete = boolWrap(
			settings.canDelete, 
			crud.hooks.canDelete
		);
	}
	//------------

	if (settings.mapFactory){
		crud.hooks.mapFactory = mapFactory(
			settings.mapFactory,
			crud.hooks.mapFactory
		);
	}

	if (settings.filterFactory){
		crud.hooks.filterFactory = filterFactory(
			settings.filterFactory,
			crud.hooks.filterFactory
		);
	}
}

module.exports = {
	hook
};
