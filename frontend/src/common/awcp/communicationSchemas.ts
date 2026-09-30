const ACTOR = { type: 'string', pattern: '^EMP-[0-9]{3}$' };
const MAIL = { type: 'string', pattern: '^MAIL-[0-9]{3}$' };
const REPLY = { type: 'string', pattern: '^REPLY-[0-9]{3}$' };
const DISCUSSION = { type: 'string', pattern: '^DISC-[0-9]{3}$' };
const PROJECT = { type: 'string', pattern: '^IBP-[0-9]{3}$' };
const ATTACHMENT = { type: 'string', pattern: '^MAILAST-[0-9]{3}$' };
const KEY = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' };
const VERSION = { type: 'integer', minimum: 1 };
const TITLE = { type: 'string', minLength: 1, maxLength: 120 };
const BODY = { type: 'string', minLength: 1, maxLength: 2000 };
const RECIPIENTS = { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: ACTOR };

export const MAIL_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'folder', 'keyword'],
  properties: {
    actorId: ACTOR,
    folder: { type: 'string', enum: ['inbox', 'archive'] },
    keyword: { type: 'string', maxLength: 120 }
  }
};
export const MAIL_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'mailId'],
  properties: { actorId: ACTOR, mailId: MAIL }
};
export const MAIL_ARCHIVE_SCHEMA = {
  ...MAIL_READ_SCHEMA,
  required: [...MAIL_READ_SCHEMA.required, 'expectedVersion', 'idempotencyKey'],
  properties: { ...MAIL_READ_SCHEMA.properties, expectedVersion: VERSION, idempotencyKey: KEY }
};
export const MAIL_REPLY_DRAFT_SCHEMA = {
  ...MAIL_READ_SCHEMA,
  required: [...MAIL_READ_SCHEMA.required, 'recipientIds', 'body', 'attachmentIds', 'idempotencyKey'],
  properties: {
    ...MAIL_READ_SCHEMA.properties,
    recipientIds: RECIPIENTS,
    body: BODY,
    attachmentIds: { type: 'array', maxItems: 10, uniqueItems: true, items: ATTACHMENT },
    idempotencyKey: KEY
  }
};
export const MAIL_SEND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'replyId', 'expectedVersion', 'idempotencyKey'],
  properties: { actorId: ACTOR, replyId: REPLY, expectedVersion: VERSION, idempotencyKey: KEY }
};
export const DISCUSSION_CREATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'projectId', 'title', 'body', 'idempotencyKey'],
  properties: { actorId: ACTOR, projectId: PROJECT, title: TITLE, body: BODY, idempotencyKey: KEY }
};
export const DISCUSSION_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'discussionId'],
  properties: { actorId: ACTOR, discussionId: DISCUSSION }
};
export const DISCUSSION_TASK_SCHEMA = {
  ...DISCUSSION_READ_SCHEMA,
  required: [...DISCUSSION_READ_SCHEMA.required, 'assigneeId', 'title', 'dueAt', 'idempotencyKey'],
  properties: {
    ...DISCUSSION_READ_SCHEMA.properties,
    assigneeId: ACTOR,
    title: TITLE,
    dueAt: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T' },
    idempotencyKey: KEY
  }
};
