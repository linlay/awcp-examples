import { expect, it } from 'vitest';

import { DemoRepository, DEMO_STORAGE_KEY, type DemoStorage } from '../src/common/store/repository';
import { WorkflowService, type WorkflowDefinition } from '../src/pc/service/workflowService';

class MemoryStorage implements DemoStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

it('creates once per business key and rejects reuse with different intent', () => {
  const repository = new DemoRepository();
  const service = new WorkflowService(repository);
  const input = {
    kind: 'travel' as const,
    actorId: 'EMP-001',
    departmentId: 'DEP-001',
    amountCents: 12345,
    idempotencyKey: 'travel-application-001'
  };
  const created = service.createForm(input);
  expect(created).toEqual({ formId: 'FORM-003', status: 'draft', businessVersion: 1 });
  expect(service.createForm(input)).toEqual(created);
  expect(repository.snapshot().forms.filter((form) => form.id === created.formId)).toHaveLength(1);
  expect(service.auditFor(created.formId)).toHaveLength(1);

  const before = repository.snapshot();
  expect(() => service.createForm({ ...input, amountCents: 2 })).toThrow('幂等键已用于其他操作');
  expect(() => service.createForm({ ...input, idempotencyKey: '' })).toThrow('业务幂等键');
  expect(() => service.createForm({ ...input, actorId: 'EMP-003', idempotencyKey: 'wrong-role' })).toThrow(
    '部门不匹配'
  );
  expect(repository.snapshot()).toEqual(before);
});

it('checks actor, state and version inside one transaction and records todo and audit', () => {
  const repository = new DemoRepository();
  const service = new WorkflowService(repository);
  const submit = {
    formId: 'FORM-002',
    actorId: 'EMP-001',
    action: 'submit',
    expectedVersion: 1,
    idempotencyKey: 'submit-form-002'
  };
  expect(service.transition(submit)).toEqual({ formId: 'FORM-002', status: 'submitted', businessVersion: 2 });
  expect(service.transition(submit)).toEqual({ formId: 'FORM-002', status: 'submitted', businessVersion: 2 });
  expect(repository.snapshot().todos.filter((todo) => todo.sourceId === 'FORM-002')).toHaveLength(1);

  const submitted = repository.snapshot();
  expect(() => service.transition({ ...submit, idempotencyKey: 'stale' })).toThrow('版本已变化');
  expect(() =>
    service.transition({
      ...submit,
      action: 'approve',
      actorId: 'EMP-001',
      expectedVersion: 2,
      idempotencyKey: 'self-approve'
    })
  ).toThrow('无权');
  expect(() =>
    service.transition({
      ...submit,
      action: 'approve',
      actorId: 'EMP-004',
      expectedVersion: 2,
      idempotencyKey: 'wrong-department'
    })
  ).toThrow('无权');
  expect(() =>
    service.transition({ ...submit, action: 'resubmit', expectedVersion: 2, idempotencyKey: 'wrong-state' })
  ).toThrow('当前状态');
  expect(repository.snapshot()).toEqual(submitted);

  const returned = service.transition({
    formId: 'FORM-002',
    actorId: 'EMP-002',
    action: 'return',
    expectedVersion: 2,
    idempotencyKey: 'return-form-002'
  });
  expect(returned).toEqual({ formId: 'FORM-002', status: 'returned', businessVersion: 3 });
  expect(repository.snapshot().todos.find((todo) => todo.sourceId === 'FORM-002')?.status).toBe('done');
  expect(
    service.transition({
      formId: 'FORM-002',
      actorId: 'EMP-001',
      action: 'resubmit',
      expectedVersion: 3,
      idempotencyKey: 'resubmit-form-002'
    }).businessVersion
  ).toBe(4);
  expect(
    service.transition({
      formId: 'FORM-002',
      actorId: 'EMP-002',
      action: 'approve',
      expectedVersion: 4,
      idempotencyKey: 'approve-form-002'
    }).status
  ).toBe('approved');
  expect(
    repository
      .snapshot()
      .todos.filter((todo) => todo.sourceId === 'FORM-002')
      .map((todo) => todo.status)
  ).toEqual(['done', 'done']);
  expect(service.auditFor('FORM-002').map((entry) => entry.action)).toEqual([
    'submit',
    'return',
    'resubmit',
    'approve'
  ]);
});

it('distinguishes attachment acceptance from completion and never treats cancellation as rollback', () => {
  const repository = new DemoRepository();
  const service = new WorkflowService(repository);
  const input = {
    assetId: 'AST-001',
    formId: 'FORM-001',
    actorId: 'EMP-001',
    expectedVersion: 1,
    idempotencyKey: 'attachment-001'
  };
  const accepted = service.queueAttachment(input);
  expect(accepted).toEqual({ status: 'accepted', jobId: 'JOB-001' });
  expect(service.readJob(accepted.jobId).status).toBe('accepted');
  expect(service.queueAttachment(input)).toEqual(accepted);
  expect(repository.snapshot().attachmentJobs).toHaveLength(1);
  expect(() => service.finishAttachment(accepted.jobId, 'EMP-002', 'completed')).toThrow('复核人员');
  const finished = service.finishAttachment(accepted.jobId, 'EMP-004', 'completed');
  expect(finished.status).toBe('completed');
  finished.status = 'failed';
  expect(service.readJob(accepted.jobId).status).toBe('completed');
  expect(service.cancelAttachment(accepted.jobId, 'EMP-001').status).toBe('completed');
  expect(service.readJob(accepted.jobId).status).toBe('completed');
  expect(repository.snapshot().attachments.find((asset) => asset.assetId === 'AST-001')?.ownerId).toBe('FORM-001');
  expect(service.auditFor(accepted.jobId).map((entry) => entry.action)).toEqual(['accept', 'completed']);

  const second = service.queueAttachment({ ...input, idempotencyKey: 'attachment-002' });
  expect(service.cancelAttachment(second.jobId, 'EMP-001').status).toBe('cancelled');
  expect(() => service.finishAttachment(second.jobId, 'EMP-004', 'completed')).toThrow('已结束');
  expect(repository.snapshot().attachments.find((asset) => asset.assetId === 'AST-001')?.ownerId).toBe('FORM-001');
});

it('migrates B06 storage in memory and persists B07 audit and idempotency on first write', () => {
  const storage = new MemoryStorage();
  const original = new DemoRepository().snapshot();
  const legacy = { ...original, schemaVersion: 1 };
  delete (legacy as Partial<typeof original>).auditEntries;
  delete (legacy as Partial<typeof original>).idempotencyRecords;
  delete (legacy as Partial<typeof original>).attachmentJobs;
  delete (legacy as Partial<typeof original>).travelRequests;
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(legacy));
  const repository = new DemoRepository({ storage });
  expect(repository.snapshot().schemaVersion).toBe(24);
  expect(repository.snapshot().auditEntries).toEqual([]);
  expect(JSON.parse(storage.getItem(DEMO_STORAGE_KEY) ?? '{}').schemaVersion).toBe(1);
  const service = new WorkflowService(repository);
  const created = service.createForm({
    kind: 'travel',
    actorId: 'EMP-001',
    departmentId: 'DEP-001',
    amountCents: 10,
    idempotencyKey: 'persist-001'
  });
  const restored = new DemoRepository({ storage });
  expect(new WorkflowService(restored).readForm(created.formId)).toEqual(service.readForm(created.formId));
  expect(new WorkflowService(restored).auditFor(created.formId)).toHaveLength(1);
  expect(
    new WorkflowService(restored).createForm({
      kind: 'travel',
      actorId: 'EMP-001',
      departmentId: 'DEP-001',
      amountCents: 10,
      idempotencyKey: 'persist-001'
    })
  ).toEqual(created);
});

it('uses configured transitions and keeps failed writes atomic', () => {
  const repository = new DemoRepository();
  const definitions: WorkflowDefinition[] = [
    {
      kind: 'travel',
      transitions: [{ action: 'verify', from: 'draft', to: 'approved', roles: ['reviewer'], actor: 'other' }]
    }
  ];
  const service = new WorkflowService(repository, definitions);
  const before = repository.snapshot();
  expect(() =>
    service.transition({
      formId: 'FORM-002',
      actorId: 'EMP-001',
      action: 'submit',
      expectedVersion: 1,
      idempotencyKey: 'custom-submit'
    })
  ).toThrow('当前状态');
  expect(() =>
    service.transition({
      formId: 'FORM-002',
      actorId: 'EMP-004',
      action: 'verify',
      expectedVersion: 1,
      idempotencyKey: 'custom-verify'
    })
  ).toThrow('无权');
  expect(repository.snapshot()).toEqual(before);
});

it('rejects invalid attachment jobs and records a failed outcome without changing ownership', () => {
  const repository = new DemoRepository();
  const service = new WorkflowService(repository);
  const input = {
    assetId: 'AST-001',
    formId: 'FORM-001',
    actorId: 'EMP-001',
    expectedVersion: 1,
    idempotencyKey: 'job-failure'
  };
  const initial = repository.snapshot();
  expect(() => service.queueAttachment({ ...input, expectedVersion: 0 })).toThrow('版本已变化');
  expect(() => service.queueAttachment({ ...input, assetId: 'AST-002' })).toThrow('未关联当前单据');
  expect(repository.snapshot()).toEqual(initial);
  const { jobId } = service.queueAttachment(input);
  expect(() => service.queueAttachment({ ...input, assetId: 'AST-002' })).toThrow('幂等键已用于其他操作');
  expect(() => service.finishAttachment(jobId, 'EMP-004', 'failed')).toThrow('需要原因');
  expect(service.readJob(jobId).status).toBe('accepted');
  expect(service.finishAttachment(jobId, 'EMP-004', 'failed', '演示扫描失败').status).toBe('failed');
  expect(service.readJob(jobId).failureReason).toBe('演示扫描失败');
  expect(repository.snapshot().attachments.find((asset) => asset.assetId === 'AST-001')?.ownerId).toBe('FORM-001');
});
