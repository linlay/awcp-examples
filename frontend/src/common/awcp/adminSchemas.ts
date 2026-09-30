const EMPLOYEE = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const ASSET = { type: 'string', pattern: '^EQ-[0-9]{3}$' };
const RESOURCE = { type: 'string', pattern: '^RES-[0-9]{3}$' };
const TICKET = { type: 'string', pattern: '^REP-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const VERSION = { type: 'integer', minimum: 1 };
const INSTANT = {
  type: 'string',
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,3})?)?(Z|[+-]\\d{2}:\\d{2})$'
};
export const ADMIN_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId'],
  properties: { actorId: EMPLOYEE }
};
export const ASSET_ASSIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'assetId', 'holderId', 'expectedVersion', 'idempotencyKey'],
  properties: { actorId: EMPLOYEE, assetId: ASSET, holderId: EMPLOYEE, expectedVersion: VERSION, idempotencyKey: KEY }
};
export const ASSET_RETURN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'assetId', 'expectedVersion', 'idempotencyKey'],
  properties: { actorId: EMPLOYEE, assetId: ASSET, expectedVersion: VERSION, idempotencyKey: KEY }
};
export const RESOURCE_RESERVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'resourceId', 'participantIds', 'driverId', 'startAt', 'endAt', 'idempotencyKey'],
  properties: {
    actorId: EMPLOYEE,
    resourceId: RESOURCE,
    participantIds: { type: 'array', minItems: 1, maxItems: 8, uniqueItems: true, items: EMPLOYEE },
    driverId: { anyOf: [EMPLOYEE, { type: 'null' }] },
    startAt: INSTANT,
    endAt: INSTANT,
    idempotencyKey: KEY
  }
};
export const REPAIR_RESOLVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'ticketId', 'resolution', 'expectedVersion', 'idempotencyKey'],
  properties: {
    actorId: EMPLOYEE,
    ticketId: TICKET,
    resolution: { type: 'string', minLength: 1, maxLength: 200 },
    expectedVersion: VERSION,
    idempotencyKey: KEY
  }
};
export const REPAIR_ACCEPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'ticketId', 'expectedVersion', 'idempotencyKey'],
  properties: { actorId: EMPLOYEE, ticketId: TICKET, expectedVersion: VERSION, idempotencyKey: KEY }
};
