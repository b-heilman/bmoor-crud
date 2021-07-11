
const {create} = require('bmoor/src/lib/error.js');

const {hook} = require('./hook.js');

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

function filterFactory(fn, old){
	if (!old){
		return fn;
	} else {
		return async function(ctx){
			const eins = await old(ctx);
			const zwei = await fn(ctx);

			return datum => eins(datum) ? zwei(datum) : false;
		};
	}
}

function secure(crud, settings){
	const accessCfg = {};
	const adminPermission = settings.adminPermission;

	// filters on data read out of the db
	if (settings.readPermission){
		accessCfg.beforeRead = function(params, ctx, service){
			if (!(ctx.hasPermission(settings.readPermission) || 
				(adminPermission && ctx.hasPermission(adminPermission)))
			){
				throw create('Not allowed to read', {
					status: 403,
					code: 'BMOOR_CRUD_NEXUS_ALLOW_READ',
					context: {
						model: service.structure.name
					}
				});
			}
		};
	}

	// do you have a permission to write a particular datum
	// allowCreate => createPermission
	if (settings.createPermission){
		accessCfg.beforeCreate = async function(datum, ctx, service){
			if (!(ctx.hasPermission(settings.createPermission) || 
				(adminPermission && ctx.hasPermission(adminPermission)))
			){
				throw create('Not allowed to create', {
					status: 403,
					code: 'BMOOR_CRUD_NEXUS_ALLOW_CREATE',
					context: {
						model: service.structure.name
					}
				});
			}
		};
	}

	// do you have a permission to update a particular datum
	if (settings.updatePermission){
		accessCfg.beforeUpdate = async function(datum, ctx, service, delta){
			if (!(ctx.hasPermission(settings.updatePermission) || 
				(adminPermission && ctx.hasPermission(adminPermission)))
			){
				throw create('Not allowed to update', {
					status: 403,
					code: 'BMOOR_CRUD_NEXUS_ALLOW_UPDATE',
					context: {
						key: service.structure.getKey(datum),
						model: service.structure.name
					},
					protected: delta
				});
			}
		};
	}

	// do you have a permission to delete a particular datum
	if (settings.deletePermission){
		accessCfg.beforeDelete = async function(datum, ctx, service){
			if (!(ctx.hasPermission(settings.deletePermission) || 
				(adminPermission && ctx.hasPermission(adminPermission)))
			){
				throw create('Not allowed to delete', {
					status: 403,
					code: 'BMOOR_CRUD_NEXUS_ALLOW_DELETE',
					context: {
						key: service.structure.getKey(datum),
						model: service.structure.name
					}
				});
			}
		};
	}

	hook(crud, accessCfg);

	//------------
	if (settings.canCreate){
		crud.security.canCreate = boolWrap(
			async function(datum, ctx){
				return (await settings.canCreate(datum, ctx)) ||
					!!(adminPermission && ctx.hasPermission(adminPermission));
			}, 
			crud.security.canCreate
		);
	}

	if (settings.canRead){
		crud.security.canRead = boolWrap(
			async function(datum, ctx){
				return (await settings.canRead(datum, ctx)) ||
					!!(adminPermission && ctx.hasPermission(adminPermission));
			}, 
			crud.security.canRead
		);
	}

	if (settings.canUpdate){
		crud.security.canUpdate = boolWrap(
			async function(datum, ctx){
				return (await settings.canUpdate(datum, ctx)) ||
					!!(adminPermission && ctx.hasPermission(adminPermission));
			}, 
			crud.security.canUpdate
		);
	}

	if (settings.canDelete){
		crud.security.canDelete = boolWrap(
			async function(datum, ctx){
				return (await settings.canDelete(datum, ctx)) ||
					!!(adminPermission && ctx.hasPermission(adminPermission));
			}, 
			crud.security.canDelete
		);
	}

	if (settings.filterPermission){
		const filterFn = function(ctx){
			return () => ctx.hasPermission(settings.filterPermission) || 
				!!(adminPermission && ctx.hasPermission(adminPermission));
		};

		crud.security.filterFactory = filterFactory(
			filterFn,
			crud.security.filterFactory
		);
	}

	if (settings.filterFactory){
		crud.security.filterFactory = filterFactory(
			function(ctx){
				const fn = settings.filterFactory(ctx);

				return datum => fn(datum) || 
					!!(adminPermission && ctx.hasPermission(adminPermission));
			},
			crud.security.filterFactory
		);
	}
}

module.exports = {
	secure
};
