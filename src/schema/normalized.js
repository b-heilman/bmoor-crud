
const {get, set} = require('bmoor/src/core.js');

// take a master datum, and a mapper reference to all classes, and convert that
// into a series of service calls

class DatumRef {
	constructor(value){
		this.value = value;
	}

	toJson(){
		return this.value;
	}
}

class Datum {
	constructor(ref, action, content){
		this.ref = ref;
		this.action = action;
		this.content = content;
	}

	setField(field, value){
		set(this.content, field, value);
	}

	getField(field){
		return get(this.content, field);
	}

	getAction(){
		return this.action;
	}

	getReference(){
		return this.ref;
	}

	toJSON(){
		return Object.keys(this.content)
		.reduce(
			(rtn, path) => {
				const d = this.content[path];

				rtn[path] = d instanceof DatumRef ? d.value : d;

				return rtn;
			},
			{
				$ref: this.ref,
				$type: this.action
			}
		);
	}

	lock(){
		return new Datum(
			this.ref,
			this.action,
			Object.keys(this.content) // TODO: need a better way to do this
			.reduce(
				(rtn, path) => {
					const d = this.content[path];

					rtn[path] = d instanceof DatumRef ? d.value : d;

					return rtn;
				},
				{}
			)
		);
	}
}

class SeriesMap extends Map {
	constructor(series, parent){
		super();

		this.parent = parent;
		this.series = series;
	}

	install(index, value){
		if (this.has(index)){
			this.get(index).push(value);
		} else {
			this.set(index, [value]);
		}

		if (this.parent){
			this.parent.install(index, value);
		}
	}

	create(index, ref, action, content){
		// the concept if someone builds a smart series, they can
		// attach DatumRefs in places and we will update inline
		let alias = null;
		if (ref instanceof(DatumRef)){
			ref.value += ':'+this.series;
			alias = ref.value;
		} else {
			alias = ref;
		}

		const datum = new Datum(alias, action, content);

		this.install(index, datum);

		return datum;
	}

	import(index, arr){
		return arr.map(command => {
			const {$ref: ref, $type: action, ...content} = command;

			return this.create(index, ref, action, content);
		});
	}

	process(index, cb){
		if (this.has(index)){
			return this.get(index).map(cb);
		}
	}
}

class Normalized extends SeriesMap {
	constructor(nexus){
		super(0);

		this.nexus = nexus;
		this.position = 1;
	}

	nextSeries(){
		const series = new SeriesMap(this.position, this);

		this.position++;

		return series;
	}

	import(schema){
		return Object.keys(schema).reduce(
			(master, model) => {
				master.import(model, schema[model]);

				return master;
			},
			this.nextSeries()
		);
	}

	toJSON(){
		const agg = {};

		for (let [index, arr] of this.entries()) {
			agg[index] = arr.map(datum => datum.toJSON());
		}

		return agg;
	}

	lock(){
		const schema = new Normalized(this.nexus);

		schema.position = this.position;

		for (let [index, arr] of this.entries()) {
			schema.set(index, arr.map(datum => datum.lock()));
		}

		return schema;
	}
}

module.exports = {
	Datum,
	DatumRef,
	Normalized
};
