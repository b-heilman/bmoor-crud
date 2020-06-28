
// search a map for connective nodes, do it x deep
class Linker {
	constructor(mapper, name){
		this.link = mapper.getLink(name);

		if (!this.link){
			throw new Error('LINKER_FAIL: '+name);
		}

		this.mapper = mapper;
	}

	// search for tables within x jumps
	search(toName, count = 999){
		let connection = this.link.getConnection(toName);

		if (connection){
			return [this.link, this.mapper.getLink(toName)];
		} else if (count === 1){
			return null;
		}

		let rtn = null;

		const toCheck = [];
		const traversed = {};

		// create initial search list

		this.link.connections.forEach(l => {
			const link = this.mapper.getLink(l.name);

			toCheck.push({
				count: count-1,
				link: link
			});
			traversed[l.name] = true;
		});
		
		// iterate over list, it can grow
		while(toCheck.length){
			const check = toCheck.shift();
			const link = check.link;
			const match = link.getConnection(toName);

			if (match){
				let iter = check;

				rtn = [link, this.mapper.getLink(toName)];

				while(iter.parent){
					rtn.unshift(iter.parent.link);
					iter = iter.parent;
				}

				rtn.unshift(this.link);

				toCheck.length = 0; // exit loop
			} else if (check.count > 1){
				// if not over count limit, add children to check list
				link.connections.forEach(l => {
					const childLink = this.mapper.getLink(l.name);

					if (!traversed[l.name]){
						toCheck.push({
							count: check.count - 1,
							link: childLink,
							parent: check // for building path later
						});
						traversed[l.name] = true;
					}
				});
			}
		}

		return rtn;
	}
}

module.exports = {
	Linker
};
