import type { JsonObject } from '@app/awcp';

const EMPLOYEE = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const DATE = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const TIME = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };
const BASE = { actorId: EMPLOYEE, employeeId: EMPLOYEE };
const DEPARTMENT: JsonObject = { anyOf: [{ type: 'string', pattern: '^DEP-[0-9]{3}$' }, { type: 'null' }] };
const POSITION: JsonObject = { anyOf: [{ type: 'string', minLength: 1, maxLength: 80 }, { type: 'null' }] };
const COURSE: JsonObject = { anyOf: [{ type: 'string', pattern: '^TRN-[0-9]{3}$' }, { type: 'null' }] };

export const HR_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'employeeId'],
  properties: BASE
};
export const LEAVE_SUBMIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'employeeId', 'startDate', 'endDate', 'reason', 'idempotencyKey'],
  properties: {
    ...BASE,
    startDate: DATE,
    endDate: DATE,
    reason: { type: 'string', minLength: 1, maxLength: 200 },
    idempotencyKey: KEY
  }
};
export const ATTENDANCE_CORRECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'employeeId', 'date', 'checkIn', 'checkOut', 'reason', 'idempotencyKey'],
  properties: {
    ...BASE,
    date: DATE,
    checkIn: TIME,
    checkOut: TIME,
    reason: { type: 'string', minLength: 1, maxLength: 200 },
    idempotencyKey: KEY
  }
};
export const PERSONNEL_PROCESS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'actorId',
    'employeeId',
    'kind',
    'targetDepartmentId',
    'targetPosition',
    'materialIds',
    'expectedVersion',
    'idempotencyKey'
  ],
  properties: {
    ...BASE,
    kind: { type: 'string', enum: ['onboard', 'transfer', 'role-change', 'offboard'] },
    targetDepartmentId: DEPARTMENT,
    targetPosition: POSITION,
    materialIds: {
      type: 'array',
      maxItems: 10,
      uniqueItems: true,
      items: { type: 'string', pattern: '^PMAT-[0-9]{3}$' }
    },
    expectedVersion: { type: 'integer', minimum: 1 },
    idempotencyKey: KEY
  }
};
export const TRAINING_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'employeeId', 'courseId'],
  properties: { ...BASE, courseId: COURSE }
};
export const TRAINING_ENROLL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'employeeId', 'courseId', 'idempotencyKey'],
  properties: { ...BASE, courseId: { type: 'string', pattern: '^TRN-[0-9]{3}$' }, idempotencyKey: KEY }
};
export const TRAINING_COMPLETE_SCHEMA = {
  ...TRAINING_ENROLL_SCHEMA,
  required: [...TRAINING_ENROLL_SCHEMA.required, 'expectedVersion'],
  properties: { ...TRAINING_ENROLL_SCHEMA.properties, expectedVersion: { type: 'integer', minimum: 1 } }
};
