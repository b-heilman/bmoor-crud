
// I understand ctx, ...args is pointless, but it shouldn't kill performance and
// I want to establish ctx is the first variable
function asyncWrap(fn, old, before = true){
	if (before){
		if (old){
			return async function(...args){
				await fn(...args);

				return old(...args);
			};
		} else {
			return fn;
		}
	} else {
		if (old){
			return async function(...args){
				await old(...args);

				return fn(...args);
			};
		} else {
			return fn;
		}
	}
}

function syncWrap(fn, old, before = true){
	if (before){
		if (old){
			return function(...args){
				fn(...args);

				return old(...args);
			};
		} else {
			return fn;
		}
	} else {
		if (old){
			return function(...args){
				old(...args);

				return fn(...args);
			};
		} else {
			return fn;
		}
	}
}

function boolWrap(fn, old){
	if (old){
		return async function(...args){
			if (fn(...args)){
				return old(...args);
			} else {
				return false;
			}
		};
	} else {
		return fn;
	}
}

module.exports = {
	asyncWrap,
	syncWrap,
	boolWrap
};
