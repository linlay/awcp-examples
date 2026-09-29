const ACTOR = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const MEMBER_IDS = { type: 'array', maxItems: 20, uniqueItems: true, items: ACTOR };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const TEAM_ID = { type: 'string', pattern: '^TEAM-[0-9]{3}$' };
const GROUP_ID = { type: 'string', pattern: '^CGROUP-[0-9]{3}$' };

export const DIRECTORY_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'departmentId', 'name'],
  properties: {
    actorId: ACTOR,
    departmentId: { type: 'string', pattern: '^(?:DEP-[0-9]{3})?$' },
    name: { type: 'string', maxLength: 80 }
  }
};
export const TEAM_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['teamId', 'actorId'],
  properties: { teamId: TEAM_ID, actorId: ACTOR }
};
export const GROUP_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['groupId', 'actorId'],
  properties: { groupId: GROUP_ID, actorId: ACTOR }
};
export const TEAM_REPLACE_SCHEMA = {
  ...TEAM_READ_SCHEMA,
  required: [...TEAM_READ_SCHEMA.required, 'expectedVersion', 'memberIds', 'idempotencyKey'],
  properties: {
    ...TEAM_READ_SCHEMA.properties,
    expectedVersion: { type: 'integer', minimum: 1 },
    memberIds: MEMBER_IDS,
    idempotencyKey: KEY
  }
};
export const GROUP_SAVE_SCHEMA = {
  ...GROUP_READ_SCHEMA,
  required: [...GROUP_READ_SCHEMA.required, 'expectedVersion', 'memberIds', 'idempotencyKey'],
  properties: {
    ...GROUP_READ_SCHEMA.properties,
    expectedVersion: { type: 'integer', minimum: 1 },
    memberIds: MEMBER_IDS,
    idempotencyKey: KEY
  }
};
