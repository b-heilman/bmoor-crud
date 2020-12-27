
---- needs tested
- encoding of schema post process

---- needed functionality
- temp sub queries
- calculated fields (calculate schema name)
- allow parameter queries for sub composites
- foreign keys to reference other objects in the schema

---- remotes (this is a http connector)
- remote : calling through to another server
- remote/service: a service that calls through to another server as a service

---- things to think about
- array of one field?

----- Decisions
- not going to support multi-key joins

----- Working Example
{
	
}

{
	base: 'event-field',
	schema: {
  		from: $event-field.path,
  		to: =generatePath(
  			> $event.name, 
  			.fieldParentId >? .id$event-field.path,
  			$event-field.path
  		),
  		parentPath: .fieldParentId >? .id$event-field.path
	}
}

{
	base: 'event-handler',
	key: null, // if not defined, pull it from the base model
	connector: knex,
	parameters: {
		status: '.status'
	},
	schema: {
		name: '.name',
		routing: {
			type: '.routingType',
			info: '.routingInfo',
			target: '.routingTarget'
		}
	}
}

{
	base: 'release-event-version',
	key: 'id',
	extends: 'event-version-instructions',
	connector: 'knex',
	parameters: {
		releaseStatus: null, // doesn't get applied to the query
		qualifier: '.qualifier' // invoke only with a field that matches this qualifier
	},
	schema: {
		qualifier: '.qualifier',
		schemaReleaseId: '.schemaReleaseId',
		schemaEventVersionId: '.schemaEventVersionId'
		canBeNull: ['=method(.schemaEventVersionId)'],
		handlers: ['
			> release-event-handlers 
			> .dasdadasd #handler-instructions(status: @releaseStatus)'
		]
	}
};