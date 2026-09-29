const EMPLOYEE = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const SUPPLIER = { type: 'string', pattern: '^SUP-[0-9]{3}$' };
const REQUEST = { type: 'string', pattern: '^PREQ-[0-9]{3}$' };
const BASE = { actorId: EMPLOYEE };
export const PROCUREMENT_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId'],
  properties: BASE
};
export const PURCHASE_CREATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'itemName', 'quantity', 'idempotencyKey'],
  properties: {
    ...BASE,
    itemName: { type: 'string', minLength: 1, maxLength: 80 },
    quantity: { type: 'integer', minimum: 1, maximum: 1000 },
    idempotencyKey: KEY
  }
};
export const PURCHASE_COMPARE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'requestId', 'quotes', 'expectedVersion', 'idempotencyKey'],
  properties: {
    ...BASE,
    requestId: REQUEST,
    quotes: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['supplierId', 'unitPriceCents'],
        properties: { supplierId: SUPPLIER, unitPriceCents: { type: 'integer', minimum: 1, maximum: 100000000 } }
      }
    },
    expectedVersion: { type: 'integer', minimum: 1 },
    idempotencyKey: KEY
  }
};
export const SUPPLIER_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'supplierId', 'decision', 'proofIds', 'note', 'expectedVersion', 'idempotencyKey'],
  properties: {
    ...BASE,
    supplierId: SUPPLIER,
    decision: { type: 'string', enum: ['approved', 'rejected'] },
    proofIds: { type: 'array', maxItems: 10, uniqueItems: true, items: { type: 'string', pattern: '^SPRF-[0-9]{3}$' } },
    note: { type: 'string', minLength: 1, maxLength: 200 },
    expectedVersion: { type: 'integer', minimum: 1 },
    idempotencyKey: KEY
  }
};
export const RECEIPT_ACCEPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'requestId', 'quantity', 'idempotencyKey'],
  properties: { ...BASE, requestId: REQUEST, quantity: { type: 'integer', minimum: 1 }, idempotencyKey: KEY }
};
