const EMPLOYEE = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const INSTITUTION = { type: 'string', pattern: '^INST-[0-9]{3}$' };
const NEED = { type: 'string', pattern: '^SNEED-[0-9]{3}$' };
const MATERIAL = { type: 'string', pattern: '^SMAT-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const VERSION = { type: 'integer', minimum: 1 };
const MATERIAL_IDS = { type: 'array', minItems: 1, uniqueItems: true, items: MATERIAL };
const BASE = { actorId: EMPLOYEE, needId: NEED, expectedVersion: VERSION, idempotencyKey: KEY };
const INSTANT = {
  type: 'string',
  pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\\.[0-9]{1,3})?)?(Z|[+-][0-9]{2}:[0-9]{2})$'
};
export const INSTITUTION_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'institutionId'],
  properties: { actorId: EMPLOYEE, institutionId: INSTITUTION }
};
export const ENTITLEMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'needId'],
  properties: { actorId: EMPLOYEE, needId: NEED }
};
export const NEED_REVISE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'needId', 'materialIds', 'reason', 'expectedVersion', 'idempotencyKey'],
  properties: { ...BASE, materialIds: MATERIAL_IDS, reason: { type: 'string', minLength: 1, maxLength: 200 } }
};
export const ROADSHOW_RESERVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'needId', 'resourceId', 'startAt', 'endAt', 'expectedVersion', 'idempotencyKey'],
  properties: { ...BASE, resourceId: { type: 'string', pattern: '^ROOM-[0-9]{3}$' }, startAt: INSTANT, endAt: INSTANT }
};
export const MATERIAL_PACKAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'needId', 'materialIds', 'expectedVersion', 'idempotencyKey'],
  properties: { ...BASE, materialIds: MATERIAL_IDS }
};
export const ROADSHOW_INVITE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'needId', 'expectedVersion', 'idempotencyKey'],
  properties: BASE
};
export const ROADSHOW_MINUTES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'needId', 'agenda', 'decisions', 'expectedVersion', 'idempotencyKey'],
  properties: {
    ...BASE,
    agenda: { type: 'string', minLength: 1, maxLength: 300 },
    decisions: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 200 } }
  }
};
export const SERVICE_FOLLOWUP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'needId', 'note', 'outcome', 'expectedVersion', 'idempotencyKey'],
  properties: {
    ...BASE,
    note: { type: 'string', minLength: 1, maxLength: 300 },
    outcome: { enum: ['satisfied', 'needs-action'] }
  }
};
