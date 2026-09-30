import { RISK_DOSSIER_SCHEMA } from './riskDossierSchemas';
const EMPLOYEE = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const ALERT = { type: 'string', pattern: '^RALT-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const VERSION = { type: 'integer', minimum: 1 };
const BASE = { actorId: EMPLOYEE, alertId: ALERT, expectedVersion: VERSION, idempotencyKey: KEY };
export const RISK_QUERY_SCHEMA: JsonObject = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'status', 'ruleId', 'page', 'pageSize'],
  properties: {
    actorId: EMPLOYEE,
    status: { enum: ['all', 'new', 'investigating', 'pending-review', 'returned', 'approved', 'closed', 'escalated'] },
    ruleId: { anyOf: [{ type: 'string', pattern: '^RRULE-[0-9]{3}$' }, { type: 'null' }] },
    page: VERSION,
    pageSize: { type: 'integer', minimum: 1, maximum: 20 }
  }
};
export const RISK_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'alertId'],
  properties: { actorId: EMPLOYEE, alertId: ALERT }
};
export const RISK_ASSIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'alertId', 'assigneeId', 'expectedVersion', 'idempotencyKey'],
  properties: { ...BASE, assigneeId: EMPLOYEE }
};
export const RISK_EVIDENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'alertId', 'evidenceId', 'expectedVersion', 'idempotencyKey'],
  properties: { ...BASE, evidenceId: { type: 'string', pattern: '^REVD-[0-9]{3}$' } }
};
export const RISK_INVESTIGATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'actorId',
    'alertId',
    'evidenceIds',
    'analysis',
    'conclusion',
    'proposedDisposition',
    'expectedVersion',
    'idempotencyKey'
  ],
  properties: {
    ...BASE,
    evidenceIds: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { type: 'string', pattern: '^REVD-[0-9]{3}$' }
    },
    dossier: RISK_DOSSIER_SCHEMA,
    analysis: { type: 'string', minLength: 1, maxLength: 500 },
    conclusion: { enum: ['false-positive', 'confirmed'] },
    proposedDisposition: { enum: ['close', 'escalate'] }
  }
};
export const RISK_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'alertId', 'decision', 'reason', 'expectedVersion', 'idempotencyKey'],
  properties: {
    ...BASE,
    decision: { enum: ['approve', 'return'] },
    reason: { type: 'string', minLength: 1, maxLength: 200 }
  }
};
export const RISK_CLOSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'alertId', 'resolution', 'expectedVersion', 'idempotencyKey'],
  properties: { ...BASE, resolution: { enum: ['close', 'escalate'] } }
};
import type { JsonObject } from '@app/awcp';
