
const fs = require('fs');

const {Config} = require('bmoor/src/lib/config.js');

const config = new Config({
	match: /(?<!spec)\.js/,
	stubs: {}
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

async function getFiles(dir){
	return gatherFiles(dir, null, config.get('match'));
}

function getSettings(file){
	return require(file);
}

const loader = {
	getFiles,
	getSettings
};

async function loadFiles(dir){
	return Promise.all(
		(await loader.getFiles(dir)).map(
			async (file) => {
				file.settings = await loader.getSettings(file.path);

				return file;
			}
		)
	);
}

loader.loadFiles = loadFiles;

module.exports = loader;
