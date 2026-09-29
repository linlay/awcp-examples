const ACTOR = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const RESOURCE = { type: 'string', pattern: '^ROOM-[0-9]{3}$' };
const MEETING = { type: 'string', pattern: '^MTG-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const TIME = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}' };
const VERSION = { type: 'integer', minimum: 1 };
const PEOPLE = { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: ACTOR };
const SLOT = { resourceId: RESOURCE, startAt: TIME, endAt: TIME };

export const MEETING_AVAILABILITY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'participantIds', 'resourceId', 'startAt', 'endAt'],
  properties: { actorId: ACTOR, participantIds: PEOPLE, ...SLOT }
};
export const MEETING_RESERVE_SCHEMA = {
  ...MEETING_AVAILABILITY_SCHEMA,
  required: [...MEETING_AVAILABILITY_SCHEMA.required, 'title', 'idempotencyKey'],
  properties: {
    ...MEETING_AVAILABILITY_SCHEMA.properties,
    title: { type: 'string', minLength: 1, maxLength: 120 },
    idempotencyKey: KEY
  }
};
export const MEETING_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'meetingId'],
  properties: { actorId: ACTOR, meetingId: MEETING }
};
export const MEETING_RESCHEDULE_SCHEMA = {
  ...MEETING_READ_SCHEMA,
  required: [...MEETING_READ_SCHEMA.required, 'resourceId', 'startAt', 'endAt', 'expectedVersion', 'idempotencyKey'],
  properties: { ...MEETING_READ_SCHEMA.properties, ...SLOT, expectedVersion: VERSION, idempotencyKey: KEY }
};
export const MEETING_MINUTES_SCHEMA = {
  ...MEETING_READ_SCHEMA,
  required: [
    ...MEETING_READ_SCHEMA.required,
    'expectedVersion',
    'attendeeIds',
    'agenda',
    'decisions',
    'actionItems',
    'idempotencyKey'
  ],
  properties: {
    ...MEETING_READ_SCHEMA.properties,
    expectedVersion: VERSION,
    attendeeIds: PEOPLE,
    agenda: { type: 'string', minLength: 1, maxLength: 2000 },
    decisions: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 500 } },
    actionItems: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'assigneeId', 'dueAt'],
        properties: { title: { type: 'string', minLength: 1, maxLength: 120 }, assigneeId: ACTOR, dueAt: TIME }
      }
    },
    idempotencyKey: KEY
  }
};
