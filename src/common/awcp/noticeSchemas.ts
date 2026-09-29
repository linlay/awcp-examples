const ACTOR = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const NOTICE = { type: 'string', pattern: '^NTC-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const READ = { noticeId: NOTICE, actorId: ACTOR };
const MUTATION = { ...READ, expectedVersion: { type: 'integer', minimum: 1 }, idempotencyKey: KEY };

export const NOTICE_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'title', 'body', 'idempotencyKey'],
  properties: {
    actorId: ACTOR,
    title: { type: 'string', minLength: 1, maxLength: 120 },
    body: { type: 'string', minLength: 1, maxLength: 2000 },
    idempotencyKey: KEY
  }
};
export const NOTICE_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['noticeId', 'actorId'],
  properties: READ
};
export const NOTICE_MUTATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['noticeId', 'actorId', 'expectedVersion', 'idempotencyKey'],
  properties: MUTATION
};
export const NOTICE_RECIPIENT_SCHEMA = {
  ...NOTICE_MUTATION_SCHEMA,
  required: [...NOTICE_MUTATION_SCHEMA.required, 'departmentIds'],
  properties: {
    ...MUTATION,
    departmentIds: {
      type: 'array',
      maxItems: 20,
      uniqueItems: true,
      items: { type: 'string', pattern: '^DEP-[0-9]{3}$' }
    }
  }
};
