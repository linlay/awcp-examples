import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { ExpenseService, type ExpenseCheckInput } from '../src/pc/service/expenseService';
import { ExpenseFlowService, type ExpenseCorrectInput } from '../src/pc/service/expenseFlowService';

const checkedInput: ExpenseCheckInput = {
  actorId: 'EMP-001',
  travelFormId: 'FORM-001',
  receipts: [{ invoiceNo: 'DEMO-HOTEL-002', assetId: 'AST-004', amountCents: 50000 }],
  lineItems: [{ category: 'hotel', invoiceNo: 'DEMO-HOTEL-002', amountCents: 50000 }],
  declaredTotalCents: 50000,
  idempotencyKey: 'expense-flow-check-001'
};

function setup() {
  const repository = new DemoRepository();
  const check = new ExpenseService(repository);
  const flow = new ExpenseFlowService(repository);
  const { expenseFormId } = check.check(checkedInput);
  return { repository, check, flow, expenseFormId };
}

it('completes submit, return, correction, resubmit and approval with versioned audit and todos', () => {
  const { repository, check, flow, expenseFormId } = setup();
  const submit = { expenseFormId, actorId: 'EMP-001', expectedVersion: 1, idempotencyKey: 'expense-submit-001' };
  expect(flow.submit(submit)).toEqual({ formId: expenseFormId, status: 'submitted', businessVersion: 2 });
  expect(flow.submit(submit).businessVersion).toBe(2);
  expect(
    repository.snapshot().todos.filter((todo) => todo.sourceId === expenseFormId && todo.status === 'open')
  ).toHaveLength(1);
  expect(flow.read({ expenseFormId, actorId: 'EMP-001' })).toMatchObject({
    status: 'submitted',
    reviewerId: 'EMP-002',
    businessVersion: 2,
    declaredTotalCents: 50000
  });

  const returned = {
    expenseFormId,
    actorId: 'EMP-002',
    expectedVersion: 2,
    decision: 'return' as const,
    reason: '住宿金额需补正',
    idempotencyKey: 'expense-return-001'
  };
  expect(flow.review(returned)).toEqual({ formId: expenseFormId, status: 'returned', businessVersion: 3 });
  expect(flow.read({ expenseFormId, actorId: 'EMP-002' }).history.at(-1)?.note).toBe('住宿金额需补正');
  expect(() => flow.submit({ ...submit, expectedVersion: 3, idempotencyKey: 'expense-resubmit-early' })).toThrow(
    '尚未按当前业务版本重新校验'
  );

  const correction: ExpenseCorrectInput = {
    ...checkedInput,
    expenseFormId,
    expectedVersion: 3,
    idempotencyKey: 'expense-correct-001',
    receipts: [{ ...checkedInput.receipts[0], amountCents: 51000 }],
    lineItems: [{ ...checkedInput.lineItems[0], amountCents: 51000 }],
    declaredTotalCents: 51000
  };
  expect(flow.validateCorrect(correction)).toEqual([]);
  expect(flow.correct(correction)).toEqual({
    expenseFormId,
    status: 'returned',
    businessVersion: 4,
    declaredTotalCents: 51000
  });
  expect(check.check(checkedInput)).toEqual({
    expenseFormId,
    status: 'checked',
    businessVersion: 1,
    declaredTotalCents: 50000
  });
  expect(flow.correct(correction).businessVersion).toBe(4);
  expect(flow.submit({ ...submit, expectedVersion: 4, idempotencyKey: 'expense-resubmit-001' }).businessVersion).toBe(
    5
  );
  expect(
    flow.review({
      expenseFormId,
      actorId: 'EMP-002',
      expectedVersion: 5,
      decision: 'approve',
      reason: '',
      idempotencyKey: 'expense-approve-001'
    }).status
  ).toBe('approved');
  const progress = flow.read({ expenseFormId, actorId: 'EMP-001' });
  expect(progress).toMatchObject({
    status: 'approved',
    businessVersion: 6,
    declaredTotalCents: 51000,
    reviewerId: null
  });
  expect(progress.history.map((item) => item.action)).toEqual([
    'expense-check',
    'submit',
    'return',
    'expense-correct',
    'resubmit',
    'approve'
  ]);
  expect(
    repository
      .snapshot()
      .todos.filter((todo) => todo.sourceId === expenseFormId)
      .map((todo) => todo.status)
  ).toEqual(['done', 'done']);
});

it('rejects unauthorized, stale and invalid operations without partial writes', () => {
  const { repository, flow, expenseFormId } = setup();
  const initial = repository.snapshot();
  expect(
    flow.validateSubmit({
      expenseFormId,
      actorId: 'EMP-002',
      expectedVersion: 1,
      idempotencyKey: 'wrong-applicant'
    })
  ).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['actorId'] })]));
  expect(() =>
    flow.submit({ expenseFormId, actorId: 'EMP-002', expectedVersion: 1, idempotencyKey: 'wrong-applicant' })
  ).toThrow('只有原申请人');
  expect(() =>
    flow.submit({ expenseFormId, actorId: 'EMP-001', expectedVersion: 0, idempotencyKey: 'stale-submit' })
  ).toThrow('业务版本已变化');
  expect(() => flow.read({ expenseFormId, actorId: 'EMP-003' })).toThrow('只有申请人或同部门主管');
  expect(repository.snapshot()).toEqual(initial);
  flow.submit({ expenseFormId, actorId: 'EMP-001', expectedVersion: 1, idempotencyKey: 'valid-submit' });
  const submitted = repository.snapshot();
  expect(() =>
    flow.review({
      expenseFormId,
      actorId: 'EMP-001',
      expectedVersion: 2,
      decision: 'approve',
      reason: '',
      idempotencyKey: 'self-approve'
    })
  ).toThrow('只有同部门');
  expect(() =>
    flow.review({
      expenseFormId,
      actorId: 'EMP-002',
      expectedVersion: 2,
      decision: 'return',
      reason: '',
      idempotencyKey: 'no-reason'
    })
  ).toThrow('退回需填写');
  expect(repository.snapshot()).toEqual(submitted);
});
