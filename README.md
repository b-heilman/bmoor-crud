# bmoor-crud

## Motivation
Attempting to simplify how complex data schemas are defined and maintained across numerous sources.  I've tried other solutions out there, but there felt right.  Not attempting to be a full ORM, but instead blue prints for stitching data together.
This ended up more ORM-like than I had wanted, but in the end we do need to know fields and their data types to do anything with more complex models.  I wanted to build a data access framework from the ground up, based squarely on the models and how they get stitched togeher.  My goal is to allow a write once, apply multiple places philosophy.

#### Future
I will be migrating all my bmoor libraries to a monorepo and to begin using TypeScript.

## Installation
This will install bmoor-crud:
```
npm install bmoor-crud
```

## Setup
In this example we are going to define a source (http), a model (a user), a decorator (to define a display method), and a guard (to expose the service).  We also will set up a server and add the guard to it. 

#### Source
We will be defining the file `src/source/otherServce.js`
```
module.exports = {
  
};
```

#### Model
We will be defining the file `src/models/user.js
```
module.exports = {
  
};
```

#### Decorator
We will be defining the file `src/decorators/user.js
```
module.exports = {
  
};
```

#### Guards
We will be defining the file `src/guards/user.js
```
module.exports = {
  
};
```

#### Server
We will be defining the file `index.js`
```
```
