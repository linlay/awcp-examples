const EMPLOYEE = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const TICKET = { type: 'string', pattern: '^TKT-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const VERSION = { type: 'integer', minimum: 1 };
export const IT_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId'],
  properties: { actorId: EMPLOYEE }
};
export const ACCESS_REQUEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'systemId', 'permissionId', 'materialIds', 'reason', 'idempotencyKey'],
  properties: {
    actorId: EMPLOYEE,
    systemId: { type: 'string', pattern: '^SYS-[0-9]{3}$' },
    permissionId: { type: 'string', pattern: '^PERM-[0-9]{3}$' },
    materialIds: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { type: 'string', pattern: '^ACMAT-[0-9]{3}$' }
    },
    reason: { type: 'string', minLength: 1, maxLength: 200 },
    idempotencyKey: KEY
  }
};
export const TICKET_ASSIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'ticketId', 'assigneeId', 'expectedVersion', 'idempotencyKey'],
  properties: {
    actorId: EMPLOYEE,
    ticketId: TICKET,
    assigneeId: EMPLOYEE,
    expectedVersion: VERSION,
    idempotencyKey: KEY
  }
};
export const TICKET_RESOLVE_SCHEMA = {
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
export const TICKET_CLOSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'ticketId', 'acceptanceNote', 'expectedVersion', 'idempotencyKey'],
  properties: {
    actorId: EMPLOYEE,
    ticketId: TICKET,
    acceptanceNote: { type: 'string', minLength: 1, maxLength: 200 },
    expectedVersion: VERSION,
    idempotencyKey: KEY
  }
};
