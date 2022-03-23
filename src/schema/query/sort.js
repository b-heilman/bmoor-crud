class QuerySort {
	constructor(series, path, ascending = true) {
		this.series = series;
		this.path = path;
		this.ascending = ascending;
	}

	toJSON() {
		return {
			series: this.series,
			path: this.path,
			ascending: this.ascending
		};
	}
}

module.exports = {
	QuerySort
};
