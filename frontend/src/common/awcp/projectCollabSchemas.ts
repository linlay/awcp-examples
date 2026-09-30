import type { JsonObject } from '@app/awcp';

const EMPLOYEE = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const PROJECT = { type: 'string', pattern: '^PRJ-[0-9]{3}$' };
const TASK = { type: 'string', pattern: '^PTASK-[0-9]{3}$' };
const MILESTONE = { type: 'string', pattern: '^PMS-[0-9]{3}$' };
const DATE = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const VERSION = { type: 'integer', minimum: 1 };
const NAME = { type: 'string', minLength: 1, maxLength: 100 };
const EMPLOYEES = { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: EMPLOYEE };
const TASKS = { type: 'array', maxItems: 20, uniqueItems: true, items: TASK };
const NULLABLE_MILESTONE: JsonObject = { anyOf: [MILESTONE, { type: 'null' }] };
const NULLABLE_VERSION: JsonObject = { anyOf: [VERSION, { type: 'null' }] };
export const PROJECT_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId'],
  properties: { actorId: EMPLOYEE }
};
export const PROJECT_CREATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'title', 'memberIds', 'dueDate', 'idempotencyKey'],
  properties: { actorId: EMPLOYEE, title: NAME, memberIds: EMPLOYEES, dueDate: DATE, idempotencyKey: KEY }
};
export const PROJECT_TASK_CREATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'projectId', 'title', 'assigneeId', 'dueDate', 'dependencyIds', 'idempotencyKey'],
  properties: {
    actorId: EMPLOYEE,
    projectId: PROJECT,
    title: NAME,
    assigneeId: EMPLOYEE,
    dueDate: DATE,
    dependencyIds: TASKS,
    idempotencyKey: KEY
  }
};
export const PROJECT_TASK_UPDATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'actorId',
    'taskId',
    'title',
    'assigneeId',
    'dueDate',
    'dependencyIds',
    'status',
    'expectedVersion',
    'idempotencyKey'
  ],
  properties: {
    actorId: EMPLOYEE,
    taskId: TASK,
    title: NAME,
    assigneeId: EMPLOYEE,
    dueDate: DATE,
    dependencyIds: TASKS,
    status: { type: 'string', enum: ['open', 'done'] },
    expectedVersion: VERSION,
    idempotencyKey: KEY
  }
};
export const PROJECT_MILESTONE_UPSERT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'projectId', 'milestoneId', 'expectedVersion', 'title', 'dueDate', 'taskIds', 'idempotencyKey'],
  properties: {
    actorId: EMPLOYEE,
    projectId: PROJECT,
    milestoneId: NULLABLE_MILESTONE,
    expectedVersion: NULLABLE_VERSION,
    title: NAME,
    dueDate: DATE,
    taskIds: { ...TASKS, minItems: 1 },
    idempotencyKey: KEY
  }
};
export const WEEKLY_REPORT_GENERATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'projectId', 'idempotencyKey'],
  properties: { actorId: EMPLOYEE, projectId: PROJECT, idempotencyKey: KEY }
};
