const ACTOR = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const READ_PROPERTIES = {
  reportId: { type: 'string', pattern: '^REPORT-[0-9]{3}$' },
  actorId: ACTOR
};
const MUTATION_PROPERTIES = {
  ...READ_PROPERTIES,
  expectedVersion: { type: 'integer', minimum: 1 },
  idempotencyKey: KEY
};

export const RESEARCH_CREATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'topicTitle', 'idempotencyKey'],
  properties: { actorId: ACTOR, topicTitle: { type: 'string', minLength: 1, maxLength: 120 }, idempotencyKey: KEY }
};

export const RESEARCH_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reportId', 'actorId'],
  properties: READ_PROPERTIES
};

export const RESEARCH_MUTATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reportId', 'actorId', 'expectedVersion', 'idempotencyKey'],
  properties: MUTATION_PROPERTIES
};

export const RESEARCH_PATCH_SCHEMA = {
  ...RESEARCH_MUTATION_SCHEMA,
  required: [...RESEARCH_MUTATION_SCHEMA.required, 'title', 'content', 'citations', 'disclosures'],
  properties: {
    ...MUTATION_PROPERTIES,
    title: { type: 'string', minLength: 1, maxLength: 160 },
    content: { type: 'string', minLength: 1, maxLength: 20000 },
    citations: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 300 } },
    disclosures: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 300 } }
  }
};

export const RESEARCH_REVIEW_SCHEMA = {
  ...RESEARCH_MUTATION_SCHEMA,
  required: [...RESEARCH_MUTATION_SCHEMA.required, 'decision', 'reason'],
  properties: {
    ...MUTATION_PROPERTIES,
    decision: { type: 'string', enum: ['approve', 'return'] },
    reason: { type: 'string', maxLength: 200 }
  }
};

export const RESEARCH_PUBLISH_SCHEMA = {
  ...RESEARCH_MUTATION_SCHEMA,
  required: [...RESEARCH_MUTATION_SCHEMA.required, 'scope'],
  properties: { ...MUTATION_PROPERTIES, scope: { type: 'string', enum: ['internal', 'clients'] } }
};
