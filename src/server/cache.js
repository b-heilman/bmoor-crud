class Memory {
	constructor(settings) {
		this.settings = settings;
		this.content = null;
		this.expires = null;
	}

	set(value) {
		this.content = value;
		this.expires = Date.now() + this.settings.ttl * 1000;
	}

	clear() {
		this.content = null;
		this.expires = null;
	}

	isValid() {
		return this.expires && this.expires > Date.now();
	}

	get() {
		return this.content;
	}
}

class Cache {
	constructor(settings = {}) {
		this.settings = settings;
		this.memories = new Map();
	}

	set(series, key, value) {
		const hash = series + ':' + key;

		if (this.memories.has(hash)) {
			this.memories.get(hash).set(value);
		} else {
			const settings = (this.settings.series && this.settings.series[series]) ||
				this.settings.default || {ttl: 60 * 5};

			const memory = new Memory(settings);

			memory.set(value);

			this.memories.set(hash, memory);
		}
	}

	has(series, key) {
		const hash = series + ':' + key;

		if (this.memories.has(hash)) {
			const memory = this.memories.get(hash);

			return memory.isValid();
		}

		return false;
	}

	get(series, key) {
		const hash = series + ':' + key;

		if (this.memories.has(hash)) {
			const memory = this.memories.get(hash);

			return memory.get();
		}

		return undefined;
	}
}

function hashObject(object) {
	return Object.keys(object)
		.sort()
		.reduce((agg, key) => {
			agg.push(key + ':' + object[key]);

			return agg;
		}, [])
		.join();
}

module.exports = {
	hashObject,
	Cache
};
