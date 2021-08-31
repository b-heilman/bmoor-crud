
const {get, set} = require('bmoor/src/core.js');

// take a master datum, and a mapper reference to all classes, and convert that
// into a series of service calls

class DatumRef {
	constructor(value=null){
		this.value = value;
	}

	setValue(value){
		this.value = value;
	}

	getValue(){
		return this.value;
	}

	toJson(){
		return this.value;
	}
}

class Datum {
	constructor(ref, action){
		this.ref = ref;
		this.action = action;
		this._content = null;
	}

	setContent(content){
		this._content = Object.assign({}, content);
	}

	getContent(){
		return this._content;
	}

	setField(field, value){
		set(this._content, field, value);
	}

	getField(field){
		return get(this._content, field);
	}

	getAction(){
		return this.action;
	}

	getReference(){
		return this.ref.value;
	}

	writeTo(tgt = {}){
		return Object.keys(this._content)
		.reduce(
			(rtn, path) => {
				const d = this._content[path];

				rtn[path] = d instanceof DatumRef ? d.value : d;

				return rtn;
			},
			tgt
		);
	}

	toJSON(){
		return this.writeTo({
			$ref: this.ref.value,
			$type: this.action
		});
	}
}

class Series extends Map {
	constructor(series){
		if (!series){
			throw new Error('Need to supply valid series');
		}

		super();

		this.series = series;
	}

	getDatum(ref, action){
		if (!ref.value){
			ref.setValue(this.series+':'+(this.size+1));
		}

		// the concept if someone builds a smart series, they can
		// attach DatumRefs in places and we will update inline
		if (this.has(ref.value)){
			return this.get(ref.value);
		} else {
			const datum = new Datum(ref, action);

			this.set(ref.value, datum);

			return datum;
		}
		
	}

	process(index, cb){
		if (this.has(index)){
			return this.get(index).map(cb);
		}
	}

	toArray(){
		return Array.from(this, ([name, value]) => value);
	}

	toJSON(){
		const rtn = [];

		for(let datum of this.values()){
			rtn.push(datum.toJSON());
		}

		return rtn;
	}
}

class Session extends Map {
	constructor(parent){
		super();
		
		this.parent = parent;
		this.state = Object.create(parent.state);
	}

	get(series){
		const rtn = super.get(series);

		if (!rtn && this.parent){
			return this.parent.get(series);
		}

		return rtn;
	}

	setVariable(key, value){
		this.state[key] = value;
	}

	getVariable(key){
		return this.state[key];
	}
	
	add(series, datum){
		if (this.has(series)){
			this.get(series).push(datum);
		} else {
			this.set(series, [datum]);
		}

		return datum;
	}

	getDatum(series, ref, action){
		return this.add(
			series,
			this.parent.getDatum(series, ref, action)
		);
	}

	setDatum(series, ref, action, content){
		const datum = this.add(
			series,
			this.parent.getDatum(series, ref, action)
		);

		datum.setContent(content);

		return datum;
	}

	stub(series){
		const datum = this.getDatum(
			series,
			new DatumRef(),
			'create'
		);

		datum.setContent({});

		return datum;
	}

	getSession(){
		return new Session(this);
	}
}

class Normalized extends Map {
	constructor(nexus){
		super();

		this.state = {};
		this.nexus = nexus;
	}

	setVariable(key, value){
		this.state[key] = value;
	}

	getVariable(key){
		return this.state[key];
	}

	getDatum(series, ref, action){
		if (this.has(series)){
			return this.get(series).getDatum(ref, action);
		} else {
			const map = new Series(series);

			this.set(series, map);

			const datum = map.getDatum(ref, action);

			return datum;
		}
	}

	getSession(){
		return new Session(this);
	}

	import(content){
		return Object.keys(content).map(
			(series) => content[series].map(
				(datum) => {
					const {$ref: ref, $type: action, ...content} = datum;

					this.getDatum(series, new DatumRef(ref), action)
						.setContent(content);
				}
			)
		);
	}

	toJSON(){
		const agg = {};

		for (let [index, series] of this.entries()) {
			agg[index] = series.toJSON();
		}

		return agg;
	}

	clone(){
		const schema = new Normalized(this.nexus);

		for (let [index, series] of this.entries()) {
			for (let datum of series.values()){
				schema.getDatum(index, datum.ref, datum.action)
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
