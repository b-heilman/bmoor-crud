# bmoor-crud

## Motivation

Attempting to simplify how complex data schemas are defined and maintained across numerous sources. I've tried other solutions out there, but there felt right. Not attempting to be a full ORM, but instead blue prints for stitching data together.
This ended up more ORM-like than I had wanted, but in the end we do need to know fields and their data types to do anything with more complex models. I wanted to build a data access framework from the ground up, based squarely on the models and how they get stitched togeher. My goal is to allow a write once, apply multiple places philosophy.

#### Future

I will be migrating all my bmoor libraries to a monorepo and to begin using TypeScript.

## Installation

This will install bmoor-crud:

```
npm install bmoor-crud
```

## Setup

In this example we are going to define a source (http), a model (a user), a decorator (to define a display method), and a guard (to expose the service). We also will set up a server and add the guard to it.

#### Source

We will be defining the file `src/source/otherService.js`

```javascript
module.exports = {
	connector: 'http',
	connectorSettings: {
		base: 'https://somewhere.com/v1/querier'
	}
};
```

#### Models

We will be defining the file `src/models/organization.js`

```javascript
module.exports = {
	source: 'otherService',
	isFlat: false, // come models can have `.` in the property, this says ignore that
	fields: {
		id: {
			read: true,
			delete: true // able to delete based on this value
		},
		title: {
			create: true,
			update: true,
			read: true,
			query: true // able to query this model based on this value
		}
	}
};
```

We will be defining the file `src/models/user.js`

```javascript
module.exports = {
	source: 'otherService',
	isFlat: false, // come models can have `.` in the property, this says ignore that
	fields: {
		id: {
			read: true,
			delete: true // able to delete based on this value
		},
		title: {
			create: true,
			update: true,
			read: true,
			query: true // able to query this model based on this value
		},
		organizationId: {
			read: true,
			link: {
				name: 'organization',
				field: 'id'
			}
		}
	}
};
```

general schema options

```javascript
{
  source,
  isFlat,
  fields: {
    [property] : { // the path of the property, can have '.' in it for heirarchy
      create // can this field be included in a creation datum?
      read   // can this field be read from the system?
      update // can this field be included in a update datum?
      delete // can we delete based on this field?
      query  // can we query based on this field?
    }
  }
}
```

#### Decorator

We will be defining the file `src/decorators/user.js`

```javascript
module.exports = {
	hello: 'world'
};
```

#### Guard

We will be defining the file `src/guards/user.js`

```javascript
module.exports = {
	eins: 'zwei'
};
```

#### Documents

We will be defining the file `src/documents/combined.js`

```javascript
module.exports = {
	base: 'user', // no $ needed
	joins: ['> $organization'], // if you don't note it, assume base is always the first
	fields: {
		title: '.title', // short hand references the base
		org: {
			title: '$organization.name'
		}
	}
};
```

General schema options

```javascript
{
  base
  joins // array of the way to join the models, > is inner join, ?> left join
  filters // predefined query for the document
  fields {
    [structure]: '$field.property' // The structure defined is the structure returned
                                   // each value is [model].[field]
  }
}
```

#### Server

We will be defining the file `index.js`

```

```

## TODO

#### Features

- Checklist for next feature branch
- [x] HTTP Connector
- [x] Create / Update / Deleta via connectors
- [x] Update crud routes to allow custom field responses
- [x] Redo configure structures / flow
- [ ] Map remote synthetic as a local model
- [ ] Convert security to async
- [ ] Set up integration test using http example
- [ ] Copy integration test to ReadMe Example
- Other features I'm kicking around
- [ ] hmmm...
