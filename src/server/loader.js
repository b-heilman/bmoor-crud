
const fs = require('fs');

const {Config} = require('bmoor/src/lib/config.js');

const config = new Config({
	match: /(?<!spec)\.js/
});

async function gatherFiles(dir, namespace, regEx){
	if (fs.existsSync(dir)) {
		const files = fs.readdirSync(dir, {withFileTypes: true});

		return files.reduce(
			async (prom, fdata) => {
				const agg = await prom;

				const path = dir+'/'+fdata.name;
				const name = fdata.name.split('.')[0];
				const full = namespace ? (namespace+'-'+name) : name;

				if (fdata.isDirectory()){
					return agg.concat(
						await gatherFiles(path, full, regEx)
					);
				} else {
					if (regEx.test(fdata.name)){
						agg.push({
							name: full,
							path
						});
					}

					return agg;
				}
			},
			[]
		);
	} else {
		return [];
	}
}

module.exports = {
	getFiles: async function(dir){
		return gatherFiles(dir, null, config.get('match'));
	},

	getSettings: function(file){
		return require(file);
	}
};
