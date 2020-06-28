
// assume white space has already been removed
function modelParser(field){
	let type = field[0];
	let target = null;

	if (type === '@'){
		const pos = field.search(/[\$\#]/);

		if (pos === -1){
			throw new Error('Target with no type: '+field);
		} else {
			target = field.substring(1,pos);
			field = field.substring(pos);
			type = field[0];
		}
	}

	const pos = field.indexOf('.');
	let loader = null;

	if (type === '#'){
		loader = 'include';
	} else if (type === '$'){
		loader = 'access';
	} else {
		throw new Error('Unknown path type: '+field);
	}

	// TODO: define series here
	if (pos === -1){
		return {
			loader,
			model: field.substring(1),
			field: null,
			target
		};
	} else {
		return {
			loader,
			model: field.substring(1, pos),
			field: field.substring(pos+1),
			target
		};
	}	
}

function pathToAccessors(field){
	let root = '';

	return field.replace(/\s/g,'')
	.split('>')
	.map(function(field){
		let parsed = modelParser(field);

		if (root){
			root += ':';
		}

		root += parsed.model;

		parsed.root = root;

		if (parsed.field){
			root += '.'+parsed.field;
		}

		return parsed;
	});
}

function accessorsToPath(accessors){
	return accessors.map(function(field){
		const rtn = [];

		if (field.target){
			rtn.push('@'+field.target);
		}

		if (field.loader){
			if (field.loader === 'access'){
				rtn.push('$');
			} else if (field.loader === 'include'){
				rtn.push('#');
			} else {
				throw new Error('unknown loader');
			}
		} else {
			throw new Error('no loader defined');
		}

		if (field.model){
			rtn.push(field.model);
		} else {
			throw new Error('no model defined');
		}

		if (field.field){
			rtn.push('.'+field.field);
		}

		return rtn.join('');
	}).join('>');
}

class Path{
	constructor(path){
		if (Array.isArray(path)){
			// path is an array of accessors and needs to built
			this.path = accessorsToPath(path);
			this.access = path;
		} else {
			// path is a string and needs to be parsed
			this.path = path;
			this.access = pathToAccessors(path);
		}
	}
}

module.exports = {
	pathToAccessors,
	accessorsToPath,
	Path
};
