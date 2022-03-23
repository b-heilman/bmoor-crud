// search a map for connective nodes, do it x deep
class Linker {
	constructor(mapper, name) {
		this.link = mapper.getLink(name);

		if (!this.link) {
			throw new Error('LINKER_FAIL: ' + name);
		}

		this.mapper = mapper;
	}

	// search for tables within x jumps
	search(toName, count = 999, settings = {}) {
		let connection = this.link.getConnection(toName);

		if (connection) {
			return [this.link, this.mapper.getLink(toName)];
		} else if (count === 1) {
			// you can make one jump and no direct connection
			return null;
		}

		let rtn = null;

		const toCheck = [];
		const traversed = {};
		const allowed = settings.allowed || {};
		const block = settings.block || {};

		// create initial search list
		this.link.connections.forEach((l) => {
			const link = this.mapper.getLink(l.name);

			if (
				!block[link.name] &&
				(!allowed[link.name] || allowed[link.name][this.link.name])
			) {
				toCheck.push({
					count: count - 1,
					link: link
				});
				traversed[l.name] = true;
			}
		});

		const nextFactory = (check) => {
			return (l) => {
				const childLink = this.mapper.getLink(l.name);

				if (
					!traversed[l.name] &&
					!block[l.name] &&
					(!allowed[childLink.name] || allowed[childLink.name][l.name])
				) {
					toCheck.push({
						count: check.count - 1,
						link: childLink,
						parent: check // for building path later
					});
					traversed[l.name] = true;
				}
			};
		};

		// iterate over list, it can grow
		while (toCheck.length) {
			const check = toCheck.shift();
			const link = check.link;

			const match =
				allowed[toName] && !allowed[toName][link.name]
					? null
					: link.getConnection(toName);

			if (match) {
				let iter = check;

				rtn = [link, this.mapper.getLink(toName)];

				while (iter.parent) {
					rtn.unshift(iter.parent.link);
					iter = iter.parent;
				}

				rtn.unshift(this.link);

				toCheck.length = 0; // exit loop
			} else if (check.count > 1) {
				// if not over count limit, add children to check list
				link.connections.forEach(nextFactory(check));
			}
		}

		return rtn;
	}
}

module.exports = {
	Linker
};
