const ACTOR = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const PROJECT = { type: 'string', pattern: '^IBP-[0-9]{3}$' };
const KIND = { type: 'string', enum: ['financial', 'legal'] };
const READ = { projectId: PROJECT, actorId: ACTOR };
const MUTATION = { ...READ, expectedVersion: { type: 'integer', minimum: 1 }, idempotencyKey: KEY };

export const IB_CREATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issuerId', 'title', 'actorId', 'idempotencyKey'],
  properties: {
    issuerId: { type: 'string', pattern: '^ISS-[0-9]{3}$' },
    title: { type: 'string', minLength: 1, maxLength: 120 },
    actorId: ACTOR,
    idempotencyKey: KEY
  }
};
export const IB_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['projectId', 'actorId'],
  properties: READ
};
export const IB_MUTATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['projectId', 'actorId', 'expectedVersion', 'idempotencyKey'],
  properties: MUTATION
};
export const IB_ASSIGN_SCHEMA = {
  ...IB_MUTATION_SCHEMA,
  required: [...IB_MUTATION_SCHEMA.required, 'kind', 'memberId'],
  properties: { ...MUTATION, kind: KIND, memberId: ACTOR }
};
export const IB_ATTACH_SCHEMA = {
  ...IB_MUTATION_SCHEMA,
  required: [...IB_MUTATION_SCHEMA.required, 'kind', 'assetId', 'summary'],
  properties: {
    ...MUTATION,
    kind: KIND,
    assetId: { type: 'string', pattern: '^IBAST-[0-9]{3}$' },
    summary: { type: 'string', minLength: 1, maxLength: 500 }
  }
};
export const IB_RESOLVE_SCHEMA = {
  ...IB_MUTATION_SCHEMA,
  required: [...IB_MUTATION_SCHEMA.required, 'findingId', 'resolution'],
  properties: {
    ...MUTATION,
    findingId: { type: 'string', pattern: '^IBFIND-[0-9]{3}$' },
    resolution: { type: 'string', minLength: 1, maxLength: 500 }
  }
};
export const IB_REVIEW_SCHEMA = {
  ...IB_MUTATION_SCHEMA,
  required: [...IB_MUTATION_SCHEMA.required, 'decision', 'reason'],
  properties: {
    ...MUTATION,
    decision: { type: 'string', enum: ['approve', 'return'] },
    reason: { type: 'string', maxLength: 200 }
  }
};
