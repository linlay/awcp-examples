import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { ApprovalService } from '../src/pc/service/approvalService';

it('saves a request and first approval task atomically and replays duplicate submission', () => {
  const repository = new DemoRepository();
  const service = new ApprovalService(repository);
  const input = {
    requestId: null,
    actorId: 'EMP-001',
    expectedVersion: null,
    title: '虚构新办公申请',
    description: '用于测试的申请说明。',
    materialIds: ['APMAT-001'],
    idempotencyKey: 'o08-submit-new'
  };
  const before = repository.snapshot();
  expect(service.validateSubmit({ ...input, materialIds: [], idempotencyKey: 'o08-no-materials' })).toContainEqual(
    expect.objectContaining({ path: ['materialIds'] })
  );
  expect(() => service.submit({ ...input, materialIds: [], idempotencyKey: 'o08-no-materials' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  const submitted = service.submit(input);
  expect(submitted).toEqual({ requestId: 'APPR-004', taskId: 'APPTODO-004', status: 'submitted', businessVersion: 1 });
  expect(service.submit(input)).toEqual(submitted);
  expect(repository.snapshot().officeApprovalRequests).toHaveLength(4);
  expect(repository.snapshot().todos.filter((item) => item.sourceId === 'APPR-004')).toHaveLength(1);
  expect(service.validateSubmit({ ...input, title: '另一项申请' })).toContainEqual(
    expect.objectContaining({ path: ['idempotencyKey'] })
  );
  expect(service.read({ requestId: 'APPR-004', actorId: 'EMP-001' })).toMatchObject({
    requestId: 'APPR-004',
    reviewerId: 'EMP-002',
    materialIds: ['APMAT-001'],
    tasks: [{ taskId: 'APPTODO-004', status: 'open' }],
    history: [{ action: 'submit', businessVersion: 1 }]
  });
});

it('accepts only the assigned manager, requires an opinion, and rejects terminal withdrawal', () => {
  const repository = new DemoRepository();
  const service = new ApprovalService(repository);
  const review = {
    requestId: 'APPR-001',
    actorId: 'EMP-002',
    expectedVersion: 1,
    opinion: '资料齐全，同意。',
    idempotencyKey: 'o08-approve'
  };
  const before = repository.snapshot();
  expect(service.validateApprove({ ...review, actorId: 'EMP-004', idempotencyKey: 'o08-wrong-actor' })).toContainEqual(
    expect.objectContaining({ path: ['actorId'] })
  );
  expect(service.validateApprove({ ...review, opinion: '', idempotencyKey: 'o08-no-opinion' })).toContainEqual(
    expect.objectContaining({ path: ['opinion'] })
  );
  expect(() => service.approve({ ...review, actorId: 'EMP-004', idempotencyKey: 'o08-wrong-actor' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  expect(service.approve(review)).toEqual({
    requestId: 'APPR-001',
    taskId: null,
    status: 'approved',
    businessVersion: 2
  });
  expect(service.approve(review).businessVersion).toBe(2);
  expect(repository.snapshot().todos.find((item) => item.id === 'APPTODO-001')?.status).toBe('done');
  expect(service.read({ requestId: 'APPR-001', actorId: 'EMP-002' })).toMatchObject({
    decisions: [{ action: 'approve', actorId: 'EMP-002', opinion: '资料齐全，同意。', businessVersion: 2 }]
  });
  expect(
    service.validateWithdraw({
      requestId: 'APPR-001',
      actorId: 'EMP-001',
      expectedVersion: 2,
      reason: '改动',
      idempotencyKey: 'o08-late-withdraw'
    })
  ).toContainEqual(expect.objectContaining({ path: ['requestId'] }));
});

it('preserves return and withdrawal history while each resubmission gets a new version and task', () => {
  const repository = new DemoRepository();
  const service = new ApprovalService(repository);
  const resubmit = {
    requestId: 'APPR-002',
    actorId: 'EMP-001',
    expectedVersion: 2,
    title: '虚构资料补正申请',
    description: '补充用途和说明。',
    materialIds: ['APMAT-002'],
    idempotencyKey: 'o08-resubmit-returned'
  };
  expect(service.submit(resubmit)).toEqual({
    requestId: 'APPR-002',
    taskId: 'APPTODO-004',
    status: 'submitted',
    businessVersion: 3
  });
  expect(
    service.return({
      requestId: 'APPR-002',
      actorId: 'EMP-002',
      expectedVersion: 3,
      opinion: '请进一步补充。',
      idempotencyKey: 'o08-return-again'
    })
  ).toEqual({
    requestId: 'APPR-002',
    taskId: null,
    status: 'returned',
    businessVersion: 4
  });
  expect(service.read({ requestId: 'APPR-002', actorId: 'EMP-001' })).toMatchObject({
    tasks: [
      { taskId: 'APPTODO-002', status: 'done' },
      { taskId: 'APPTODO-004', status: 'done' }
    ],
    decisions: [
      { action: 'return', businessVersion: 2 },
      { action: 'return', businessVersion: 4 }
    ]
  });
  const first = service.withdraw({
    requestId: 'APPR-001',
    actorId: 'EMP-001',
    expectedVersion: 1,
    reason: '需要修改。',
    idempotencyKey: 'o08-withdraw'
  });
  expect(first).toEqual({ requestId: 'APPR-001', taskId: null, status: 'withdrawn', businessVersion: 2 });
  expect(
    service.withdraw({
      requestId: 'APPR-001',
      actorId: 'EMP-001',
      expectedVersion: 1,
      reason: '需要修改。',
      idempotencyKey: 'o08-withdraw'
    })
  ).toEqual(first);
  expect(
    service.submit({
      requestId: 'APPR-001',
      actorId: 'EMP-001',
      expectedVersion: 2,
      title: '虚构办公用品申请修订',
      description: '修改后重新提交。',
      materialIds: ['APMAT-001', 'APMAT-002'],
      idempotencyKey: 'o08-resubmit-withdrawn'
    })
  ).toEqual({ requestId: 'APPR-001', taskId: 'APPTODO-005', status: 'submitted', businessVersion: 3 });
  expect(service.read({ requestId: 'APPR-001', actorId: 'EMP-001' })).toMatchObject({
    tasks: [
      { taskId: 'APPTODO-001', status: 'done' },
      { taskId: 'APPTODO-005', status: 'open' }
    ],
    decisions: [{ action: 'withdraw', businessVersion: 2 }],
    history: [
      { action: 'withdraw', businessVersion: 2 },
      { action: 'submit', businessVersion: 3 }
    ]
  });
  expect(
    service.validateSubmit({
      requestId: 'APPR-001',
      actorId: 'EMP-001',
      expectedVersion: 2,
      title: '虚构办公用品申请修订',
      description: '修改后重新提交。',
      materialIds: ['APMAT-001'],
      idempotencyKey: 'o08-stale'
    })
  ).toContainEqual(expect.objectContaining({ path: ['requestId'] }));
});
