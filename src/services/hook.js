function asyncWrap(fn, old, before = true) {
	if (before) {
		if (old) {
			return async function (datum, ctx, self, delta = {}) {
				await fn(datum, ctx, self, delta);

				return old(datum, ctx, self, delta);
			};
		} else {
			return fn;
		}
	} else {
		if (old) {
			return async function (datum, ctx, self, delta = {}) {
				await old(datum, ctx, self, delta);

				return fn(datum, ctx, self, delta);
			};
		} else {
			return fn;
		}
	}
}

function mapFactory(fn, old) {
	if (!old) {
		return fn;
	} else {
		return async function (ctx) {
			const eins = await old(ctx);
			const zwei = await fn(ctx);

			return function (datum) {
				return zwei(eins(datum));
			};
		};
	}
}

function hook(crud, settings) {
	if (settings.beforeCreate) {
		crud.hooks.beforeCreate = asyncWrap(
			settings.beforeCreate,
			crud.hooks.beforeCreate,
			true
		);
	}

	if (settings.afterCreate) {
		crud.hooks.afterCreate = asyncWrap(
			settings.afterCreate,
			crud.hooks.afterCreate,
			false
		);
	}

	if (settings.beforeRead) {
		crud.hooks.beforeRead = asyncWrap(
			settings.beforeRead,
			crud.hooks.beforeRead,
			true
		);
	}

	if (settings.beforeUpdate) {
		crud.hooks.beforeUpdate = asyncWrap(
			settings.beforeUpdate,
			crud.hooks.beforeUpdate,
			true
		);
	}

	if (settings.afterUpdate) {
		crud.hooks.afterUpdate = asyncWrap(
			settings.afterUpdate,
			crud.hooks.afterUpdate,
			false
		);
	}

	if (settings.beforeDelete) {
		crud.hooks.beforeDelete = asyncWrap(
			settings.beforeDelete,
			crud.hooks.beforeDelete,
			true
		);
	}

	if (settings.afterDelete) {
		crud.hooks.afterDelete = asyncWrap(
			settings.afterDelete,
			crud.hooks.afterDelete,
			false
		);
	}

	//------------

	if (settings.mapFactory) {
		crud.hooks.mapFactory = mapFactory(
			settings.mapFactory,
			crud.hooks.mapFactory
		);
	}
}

module.exports = {
	hook
};
