import type { JsonObject } from '@app/awcp';

const ACTOR = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const DEPARTMENT: JsonObject = { anyOf: [{ type: 'string', pattern: '^DEP-[0-9]{3}$' }, { type: 'null' }] };
const STATUS: JsonObject = { anyOf: [{ type: 'string', enum: ['draft', 'confirmed'] }, { type: 'null' }] };
const AMOUNT = { type: 'integer', minimum: 0, maximum: 100000000 };
const FILTER: Record<string, JsonObject> = {
  actorId: ACTOR,
  keyword: { type: 'string', maxLength: 120 },
  departmentId: DEPARTMENT,
  status: STATUS,
  minAmountCents: { anyOf: [AMOUNT, { type: 'null' }] },
  sortBy: { type: 'string', enum: ['id', 'amountCents'] },
  sortDirection: { type: 'string', enum: ['asc', 'desc'] }
};
const FILTER_REQUIRED = Object.keys(FILTER);
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };

export const SHEET_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [...FILTER_REQUIRED, 'page', 'pageSize'],
  properties: {
    ...FILTER,
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 50 }
  }
};
export const SHEET_PATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'changes', 'idempotencyKey'],
  properties: {
    actorId: ACTOR,
    changes: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rowId', 'expectedVersion', 'label', 'amountCents', 'status'],
        properties: {
          rowId: { type: 'string', pattern: '^SROW-[0-9]{3}$' },
          expectedVersion: { type: 'integer', minimum: 1 },
          label: { type: 'string', minLength: 1, maxLength: 80 },
          amountCents: AMOUNT,
          status: { type: 'string', enum: ['draft', 'confirmed'] }
        }
      }
    },
    idempotencyKey: KEY
  }
};
export const SHEET_IMPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'rows'],
  properties: {
    actorId: ACTOR,
    rows: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object' } }
  }
};
export const SHEET_EXPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [...FILTER_REQUIRED, 'idempotencyKey'],
  properties: { ...FILTER, idempotencyKey: KEY }
};
