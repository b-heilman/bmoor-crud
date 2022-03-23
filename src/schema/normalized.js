const {get, set} = require('bmoor/src/core.js');

// take a master datum, and a mapper reference to all classes, and convert that
// into a series of service calls

class DatumRef {
	constructor(hash = null) {
		this.hash = hash;
	}

	hasHash() {
		return !!this.hash;
	}

	setHash(hash) {
		this.hash = hash;
	}

	getHash() {
		return this.hash;
	}

	toJson() {
		return this.hash;
	}
}

class Datum {
	constructor(ref) {
		this.ref = ref;
		this.content = null;
	}

	setContent(content) {
		this.content = Object.assign({}, content);

		return this;
	}

	getContent() {
		return this.content;
	}

	setField(field, value) {
		set(this.content, field, value);

		return this;
	}

	getField(field) {
		return get(this.content, field);
	}

	setAction(action) {
		this.action = action;

		return this;
	}

	getAction() {
		return this.action;
	}

	getReference() {
		return this.ref;
	}

	writeTo(tgt = {}) {
		return Object.keys(this.content).reduce((rtn, path) => {
			const d = this.content[path];

			rtn[path] = d instanceof DatumRef ? d.getHash() : d;

			return rtn;
		}, tgt);
	}

	toJSON() {
		return this.writeTo({
			$ref: this.ref.getHash(),
			$type: this.action
		});
	}
}

class Series extends Map {
	constructor(name) {
		super();

		this.name = name;
	}

	addDatum(datum) {
		this.set(datum.ref.getHash(), datum);

		return datum;
	}

	ensureDatum(ref) {
		if (!ref.hasHash()) {
			ref.setHash(this.name + ':' + (this.size + 1));
		}

		const hash = ref.getHash();
		if (this.has(hash)) {
			return this.get(hash);
		} else {
			return this.addDatum(new Datum(ref));
		}
	}

	toArray() {
		return Array.from(this, (arr) => arr[1]);
	}

	toJSON() {
		const rtn = [];

		for (let datum of this.values()) {
			rtn.push(datum.toJSON());
		}

		return rtn;
	}
}

class Session {
	constructor(normalized, parent = null) {
		this.series = {};

		this.parent = parent;
		this.children = [];
		this.normalized = normalized;
	}

	getChildSession() {
		const child = new Session(this.normalized, this);

		this.children.push(child);

		return child;
	}

	_addDatum(series, datum) {
		const seriesGroup = this.series[series];

		if (seriesGroup) {
			seriesGroup.push(datum);
		} else {
			this.series[series] = [datum];
		}

		if (this.parent) {
			this.parent._addDatum(series, datum);
		}

		return datum;
	}

	defineDatum(series, ref = new DatumRef(), action = 'create', content = {}) {
		return this._addDatum(
			series,
			this.normalized
				.ensureSeries(series)
				.ensureDatum(ref)
				.setAction(action)
				.setContent(content)
		);
	}

	getStub(series) {
		return this._addDatum(series, this.normalized.getStub(series));
	}

	getSeries(series) {
		const rtn = this.series[series];

		if (!rtn && this.parent) {
			return this.parent.getSeries(series);
		}

		return rtn;
	}

	findLink(series) {
		let rtn = this.getSeries(series);

		if (!rtn) {
			return null;
		}

		if (rtn.length > 1) {
			throw new Error('found too many links');
		}

		return rtn[0];
	}
}

class Normalized extends Map {
	constructor(nexus) {
		super();

		this.nexus = nexus;
		this.modelIndex = {};
	}

	ensureSeries(seriesName) {
		if (this.has(seriesName)) {
			return this.get(seriesName);
		} else {
			const series = new Series(seriesName);

			this.set(seriesName, series);

			return series;
		}
	}

	getStub(series) {
		return this.ensureSeries(series)
			.ensureDatum(new DatumRef())
			.setAction('create')
			.setContent({});
	}

	getSession() {
		return new Session(this);
	}

	import(content) {
		return Object.keys(content).map((series) =>
			content[series].map((datum) => {
				const {$ref: ref, $type: action, ...content} = datum;

				this.ensureSeries(series)
					.ensureDatum(new DatumRef(ref))
					.setAction(action)
					.setContent(content);
			})
		);
	}

	async lookupModels(fn) {
		const agg = {};

		for (let series of this.values()) {
			agg[series.name] = await fn(series.name);
		}

		this.modelIndex = agg;
	}

	toJSON() {
		const agg = {};

		for (let series of this.values()) {
			const model = this.modelIndex[series.name] || series.name;
			const existing = agg[model];

			if (existing) {
				agg[model] = existing.concat(series.toJSON());
			} else {
				agg[model] = series.toJSON();
			}
		}

		return agg;
	}

	clone() {
		const schema = new Normalized(this.nexus);

		for (let [index, series] of this.entries()) {
			for (let datum of series.values()) {
				schema
					.ensureSeries(index)
					.ensureDatum(datum.ref)
					.setAction(datum.action)
					.setContent(datum.writeTo({}));
			}
		}

		return schema;
	}
}

module.exports = {
	Datum,
	DatumRef,
	Normalized
};
