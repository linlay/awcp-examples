const ACTOR = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const DOCUMENT = { type: 'string', pattern: '^DOC-[0-9]{3}$' };
const BLOCK = { type: 'string', pattern: '^DBLK-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const VERSION = { type: 'integer', minimum: 1 };

export const DOCUMENT_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'keyword'],
  properties: { actorId: ACTOR, keyword: { type: 'string', maxLength: 120 } }
};
export const DOCUMENT_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'documentId', 'version'],
  properties: { actorId: ACTOR, documentId: DOCUMENT, version: { anyOf: [VERSION, { type: 'null' }] } }
};
export const DOCUMENT_PATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'documentId', 'expectedVersion', 'blockId', 'text', 'idempotencyKey'],
  properties: {
    actorId: ACTOR,
    documentId: DOCUMENT,
    expectedVersion: VERSION,
    blockId: BLOCK,
    text: { type: 'string', minLength: 1, maxLength: 2000 },
    idempotencyKey: KEY
  }
};
export const DOCUMENT_DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'documentId', 'documentVersion', 'expectedVersion', 'idempotencyKey'],
  properties: {
    actorId: ACTOR,
    documentId: DOCUMENT,
    documentVersion: VERSION,
    expectedVersion: VERSION,
    idempotencyKey: KEY
  }
};
