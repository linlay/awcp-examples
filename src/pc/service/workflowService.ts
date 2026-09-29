import type { JsonObject } from '@app/awcp';

import { businessError } from '../../common/awcp/contracts';
import type {
  AttachmentJob,
  BusinessAuditEntry,
  BusinessForm,
  DemoRole,
  DemoState,
  Employee
} from '../../common/fixtures/types';
import type { DemoRepository } from '../../common/store/repository';

export interface WorkflowTransition {
  action: string;
  from: BusinessForm['status'];
  to: BusinessForm['status'];
  roles: readonly DemoRole[];
  actor: 'applicant' | 'other';
}

export interface WorkflowDefinition {
  kind: BusinessForm['kind'];
  transitions: readonly WorkflowTransition[];
}

export const DEFAULT_WORKFLOWS: readonly WorkflowDefinition[] = (['travel', 'expense', 'general'] as const).map(
  (kind) => ({
    kind,
    transitions: [
      { action: 'submit', from: 'draft', to: 'submitted', roles: ['employee'], actor: 'applicant' },
      { action: 'resubmit', from: 'returned', to: 'submitted', roles: ['employee'], actor: 'applicant' },
      { action: 'approve', from: 'submitted', to: 'approved', roles: ['manager'], actor: 'other' },
      { action: 'return', from: 'submitted', to: 'returned', roles: ['manager'], actor: 'other' }
    ]
  })
);

export interface CreateFormInput {
  kind: BusinessForm['kind'];
  actorId: string;
  departmentId: string;
  amountCents: number;
  idempotencyKey: string;
}

export interface TransitionInput {
  formId: string;
  actorId: string;
  action: string;
  expectedVersion: number;
  idempotencyKey: string;
  reason?: string;
}

export type TransitionGuard = (state: Readonly<DemoState>, form: Readonly<BusinessForm>) => void;

export interface QueueAttachmentInput {
  assetId: string;
  formId: string;
  actorId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface FormMutationResult extends JsonObject {
  formId: string;
  status: BusinessForm['status'];
  businessVersion: number;
}

export class WorkflowService {
  constructor(
    private readonly repository: DemoRepository,
    private readonly definitions: readonly WorkflowDefinition[] = DEFAULT_WORKFLOWS
  ) {}

  readForm(formId: string): BusinessForm {
    return requireForm(this.repository.snapshot(), formId);
  }

  auditFor(entityId: string): BusinessAuditEntry[] {
    return this.repository.snapshot().auditEntries.filter((entry) => entry.entityId === entityId);
  }

  createForm(input: CreateFormInput): FormMutationResult {
    const operation = 'form.create';
    const fingerprint = JSON.stringify([input.kind, input.actorId, input.departmentId, input.amountCents]);
    return this.repository.transact((draft) => {
      const replay = replayRecord(draft, input.idempotencyKey, operation, fingerprint);
      if (replay) return replayForm(replay);
      const actor = requireActor(draft, input.actorId);
      if (!actor.roles.includes('employee') || actor.departmentId !== input.departmentId) {
        throw businessError('action.role-denied', '申请人角色或部门不匹配。');
      }
      if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0) {
        throw businessError('action.invalid-amount', '金额必须是非负整数分。');
      }
      if (!this.definitions.some((definition) => definition.kind === input.kind)) {
        throw businessError('action.workflow-not-found', '未配置该单据类型的状态机。');
      }
      const id = nextId(
        'FORM',
        draft.forms.map((form) => form.id)
      );
      const form: BusinessForm = {
        id,
        kind: input.kind,
        applicantId: actor.id,
        departmentId: input.departmentId,
        status: 'draft',
        businessVersion: 1,
        amountCents: input.amountCents,
        createdAt: this.repository.clock.now()
      };
      draft.forms.push(form);
      audit(draft, this.repository.clock.now(), 'form', id, 'create', actor.id, null, 'draft', 1);
      remember(draft, input.idempotencyKey, operation, fingerprint, id, 1, 'draft');
      return resultFor(form);
    });
  }

  transition(input: TransitionInput, guard?: TransitionGuard): FormMutationResult {
    const operation = `form.${input.action}`;
    const fingerprint = JSON.stringify(
      input.reason === undefined
        ? [input.formId, input.actorId, input.expectedVersion]
        : [input.formId, input.actorId, input.expectedVersion, input.reason]
    );
    return this.repository.transact((draft) => {
      const replay = replayRecord(draft, input.idempotencyKey, operation, fingerprint);
      if (replay) return replayForm(replay);
      const form = requireForm(draft, input.formId);
      const actor = requireActor(draft, input.actorId);
      if (form.businessVersion !== input.expectedVersion) {
        throw businessError('action.version-conflict', '单据版本已变化，请刷新后重试。', {
          actualVersion: form.businessVersion
        });
      }
      const definition = this.definitions.find((item) => item.kind === form.kind);
      const transition = definition?.transitions.find(
        (item) => item.action === input.action && item.from === form.status
      );
      if (!transition) throw businessError('action.invalid-transition', '当前状态不允许此操作。');
      if (
        !transition.roles.some((role) => actor.roles.includes(role)) ||
        (transition.actor === 'applicant' && actor.id !== form.applicantId) ||
        (transition.actor === 'other' && (actor.id === form.applicantId || actor.departmentId !== form.departmentId))
      ) {
        throw businessError('action.role-denied', '当前人员无权执行此状态迁移。');
      }
      guard?.(draft, form);
      const previousStatus = form.status;
      form.status = transition.to;
      form.businessVersion += 1;
      if (transition.to === 'submitted') {
        const manager = draft.employees.find(
          (employee) =>
            employee.active && employee.departmentId === form.departmentId && employee.roles.includes('manager')
        );
        if (!manager) throw businessError('action.approver-not-found', '当前部门没有可用审批人。');
        draft.todos.push({
          id: nextId(
            'TODO',
            draft.todos.map((todo) => todo.id)
          ),
          title: `审批演示${form.kind}申请`,
          assigneeId: manager.id,
          sourceType: 'form',
          sourceId: form.id,
          dueAt: new Date(Date.parse(this.repository.clock.now()) + 24 * 60 * 60 * 1000).toISOString(),
          status: 'open'
        });
      } else {
        for (const todo of draft.todos) {
          if (todo.sourceType === 'form' && todo.sourceId === form.id && todo.status === 'open') {
            todo.status = 'done';
            todo.completedAt = this.repository.clock.now();
          }
        }
      }
      audit(
        draft,
        this.repository.clock.now(),
        'form',
        form.id,
        input.action,
        actor.id,
        previousStatus,
        form.status,
        form.businessVersion,
        input.reason
      );
      remember(draft, input.idempotencyKey, operation, fingerprint, form.id, form.businessVersion, form.status);
      return resultFor(form);
    });
  }

  queueAttachment(input: QueueAttachmentInput): { status: 'accepted'; jobId: string } {
    const operation = 'attachment.queue';
    const fingerprint = JSON.stringify([input.assetId, input.formId, input.actorId, input.expectedVersion]);
    return this.repository.transact((draft) => {
      const replay = replayRecord(draft, input.idempotencyKey, operation, fingerprint);
      if (replay) return { status: 'accepted', jobId: replay.resultId };
      const form = requireForm(draft, input.formId);
      const actor = requireActor(draft, input.actorId);
      if (form.applicantId !== actor.id || !actor.roles.includes('employee')) {
        throw businessError('action.role-denied', '只有申请人可以提交附件任务。');
      }
      if (form.businessVersion !== input.expectedVersion) {
        throw businessError('action.version-conflict', '单据版本已变化，请刷新后重试。', {
          actualVersion: form.businessVersion
        });
      }
      const asset = draft.attachments.find((item) => item.assetId === input.assetId);
      if (!asset || asset.ownerId !== form.id) throw businessError('action.asset-not-found', '附件未关联当前单据。');
      const job: AttachmentJob = {
        id: nextId(
          'JOB',
          draft.attachmentJobs.map((item) => item.id)
        ),
        assetId: asset.assetId,
        formId: form.id,
        actorId: input.actorId,
        status: 'accepted',
        acceptedAt: this.repository.clock.now(),
        finishedAt: null,
        failureReason: null
      };
      draft.attachmentJobs.push(job);
      audit(
        draft,
        this.repository.clock.now(),
        'attachment-job',
        job.id,
        'accept',
        input.actorId,
        null,
        'accepted',
        null
      );
      remember(draft, input.idempotencyKey, operation, fingerprint, job.id, null, 'accepted');
      return { status: 'accepted', jobId: job.id };
    });
  }

  readJob(jobId: string): AttachmentJob {
    const job = this.repository.snapshot().attachmentJobs.find((item) => item.id === jobId);
    if (!job) throw businessError('action.job-not-found', '附件任务不存在。');
    return job;
  }

  finishAttachment(
    jobId: string,
    actorId: string,
    outcome: 'completed' | 'failed',
    failureReason?: string
  ): AttachmentJob {
    return this.repository.transact((draft) => {
      const actor = requireActor(draft, actorId);
      if (!actor.roles.includes('reviewer'))
        throw businessError('action.role-denied', '只有复核人员可以处理附件任务。');
      if (outcome !== 'completed' && outcome !== 'failed') {
        throw businessError('action.invalid-job-outcome', '不支持的附件任务结果。');
      }
      const job = draft.attachmentJobs.find((item) => item.id === jobId);
      if (!job) throw businessError('action.job-not-found', '附件任务不存在。');
      if (job.status !== 'accepted') throw businessError('action.job-finalized', '附件任务已结束，请查询当前状态。');
      if (outcome === 'failed' && !failureReason?.trim()) {
        throw businessError('action.failure-reason-required', '失败任务需要原因。');
      }
      job.status = outcome;
      job.finishedAt = this.repository.clock.now();
      job.failureReason = outcome === 'failed' ? (failureReason?.trim() ?? null) : null;
      audit(draft, this.repository.clock.now(), 'attachment-job', job.id, outcome, actorId, 'accepted', outcome, null);
      return { ...job };
    });
  }

  cancelAttachment(jobId: string, actorId: string): AttachmentJob {
    return this.repository.transact((draft) => {
      requireActor(draft, actorId);
      const job = draft.attachmentJobs.find((item) => item.id === jobId);
      if (!job) throw businessError('action.job-not-found', '附件任务不存在。');
      if (job.actorId !== actorId) throw businessError('action.role-denied', '只有任务申请人可以取消。');
      if (job.status !== 'accepted') return { ...job };
      job.status = 'cancelled';
      job.finishedAt = this.repository.clock.now();
      audit(
        draft,
        this.repository.clock.now(),
        'attachment-job',
        job.id,
        'cancel',
        actorId,
        'accepted',
        'cancelled',
        null
      );
      return { ...job };
    });
  }
}

function requireActor(state: DemoState, actorId: string): Employee {
  const actor = state.employees.find((item) => item.id === actorId && item.active);
  if (!actor) throw businessError('action.actor-not-found', '当前人员不存在或已停用。');
  return actor;
}

function requireForm(state: DemoState, formId: string): BusinessForm {
  const form = state.forms.find((item) => item.id === formId);
  if (!form) throw businessError('action.form-not-found', '申请单不存在。');
  return form;
}

function nextId(prefix: string, ids: readonly string[]): string {
  const max = ids.reduce((current, id) => {
    const match = new RegExp(`^${prefix}-([0-9]+)$`).exec(id);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

function replayRecord(state: DemoState, key: string, operation: string, fingerprint: string) {
  if (!key || key.length > 128 || !key.trim())
    throw businessError('action.idempotency-key-required', '需要有效业务幂等键。');
  const record = state.idempotencyRecords.find((item) => item.key === key);
  if (record && (record.operation !== operation || record.fingerprint !== fingerprint)) {
    throw businessError('action.idempotency-conflict', '业务幂等键已用于其他操作或参数。');
  }
  return record;
}

function remember(
  state: DemoState,
  key: string,
  operation: string,
  fingerprint: string,
  resultId: string,
  resultVersion: number | null,
  resultStatus: string
): void {
  state.idempotencyRecords.push({ key, operation, fingerprint, resultId, resultVersion, resultStatus });
}

function replayForm(record: DemoState['idempotencyRecords'][number]): FormMutationResult {
  if (record.resultVersion === null || !isFormStatus(record.resultStatus))
    throw new Error('Invalid form idempotency record.');
  return { formId: record.resultId, businessVersion: record.resultVersion, status: record.resultStatus };
}

function isFormStatus(status: string): status is BusinessForm['status'] {
  return status === 'draft' || status === 'submitted' || status === 'approved' || status === 'returned';
}

function resultFor(form: BusinessForm): FormMutationResult {
  return { formId: form.id, status: form.status, businessVersion: form.businessVersion };
}

function audit(
  state: DemoState,
  at: string,
  entityType: BusinessAuditEntry['entityType'],
  entityId: string,
  action: string,
  actorId: string,
  fromStatus: string | null,
  toStatus: string,
  businessVersion: number | null,
  note?: string
): void {
  state.auditEntries.push({
    id: nextId(
      'AUD',
      state.auditEntries.map((entry) => entry.id)
    ),
    entityType,
    entityId,
    action,
    actorId,
    at,
    fromStatus,
    toStatus,
    businessVersion,
    ...(note ? { note } : {})
  });
}
