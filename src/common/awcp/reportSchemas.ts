const EMPLOYEE = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const DEPARTMENT = { type: 'string', pattern: '^DEP-[0-9]{3}$' };
const JOB = { type: 'string', pattern: '^RJOB-[0-9]{3}$' };
const ARCHIVE = { type: 'string', pattern: '^ARC-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const DATE = { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' };
export const REPORT_GENERATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'departmentId', 'startDate', 'endDate', 'idempotencyKey'],
  properties: { actorId: EMPLOYEE, departmentId: DEPARTMENT, startDate: DATE, endDate: DATE, idempotencyKey: KEY }
};
export const REPORT_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'jobId'],
  properties: { actorId: EMPLOYEE, jobId: JOB }
};
export const REPORT_DETAILS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'jobId', 'page', 'pageSize'],
  properties: {
    actorId: EMPLOYEE,
    jobId: JOB,
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 20 }
  }
};
export const ARCHIVE_SEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'archiveId', 'version'],
  properties: { actorId: EMPLOYEE, archiveId: ARCHIVE, version: { type: 'integer', minimum: 1 } }
};
export const ARCHIVE_SAVE_SCHEMA: JsonObject = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'reportId', 'archiveId', 'expectedVersion', 'idempotencyKey'],
  properties: {
    actorId: EMPLOYEE,
    reportId: JOB,
    archiveId: { anyOf: [ARCHIVE, { type: 'null' }] },
    expectedVersion: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
    idempotencyKey: KEY
  }
};
import type { JsonObject } from '@app/awcp';
