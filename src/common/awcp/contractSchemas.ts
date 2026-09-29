const EMPLOYEE = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const CONTRACT = { type: 'string', pattern: '^CNTR-[0-9]{3}$' };
const SEAL = { type: 'string', pattern: '^SEAL-[0-9]{3}$' };
const DATE = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const MATERIALS = {
  type: 'array',
  minItems: 1,
  maxItems: 10,
  uniqueItems: true,
  items: { type: 'string', pattern: '^CTMAT-[0-9]{3}$' }
};
const AMOUNT = { type: 'integer', minimum: 1, maximum: 1000000000000 };
const VERSION = { type: 'integer', minimum: 1 };
export const CONTRACT_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId'],
  properties: { actorId: EMPLOYEE }
};
export const CONTRACT_REGISTER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'actorId',
    'companyId',
    'counterpartyName',
    'startDate',
    'endDate',
    'amountCents',
    'materialIds',
    'idempotencyKey'
  ],
  properties: {
    actorId: EMPLOYEE,
    companyId: { type: 'string', pattern: '^COMP-[0-9]{3}$' },
    counterpartyName: { type: 'string', minLength: 1, maxLength: 100 },
    startDate: DATE,
    endDate: DATE,
    amountCents: AMOUNT,
    materialIds: MATERIALS,
    idempotencyKey: KEY
  }
};
export const SEAL_SUBMIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'contractId', 'contractVersion', 'purpose', 'materialIds', 'idempotencyKey'],
  properties: {
    actorId: EMPLOYEE,
    contractId: CONTRACT,
    contractVersion: VERSION,
    purpose: { type: 'string', minLength: 1, maxLength: 200 },
    materialIds: MATERIALS,
    idempotencyKey: KEY
  }
};
export const SEAL_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'sealId', 'decision', 'note', 'expectedVersion', 'idempotencyKey'],
  properties: {
    actorId: EMPLOYEE,
    sealId: SEAL,
    decision: { type: 'string', enum: ['approved', 'rejected'] },
    note: { type: 'string', minLength: 1, maxLength: 200 },
    expectedVersion: VERSION,
    idempotencyKey: KEY
  }
};
export const SEAL_EXECUTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'sealId', 'expectedVersion', 'idempotencyKey'],
  properties: { actorId: EMPLOYEE, sealId: SEAL, expectedVersion: VERSION, idempotencyKey: KEY }
};
export const RENEWAL_CREATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'actorId',
    'sourceContractId',
    'sourceVersion',
    'startDate',
    'endDate',
    'amountCents',
    'materialIds',
    'idempotencyKey'
  ],
  properties: {
    actorId: EMPLOYEE,
    sourceContractId: CONTRACT,
    sourceVersion: VERSION,
    startDate: DATE,
    endDate: DATE,
    amountCents: AMOUNT,
    materialIds: MATERIALS,
    idempotencyKey: KEY
  }
};
