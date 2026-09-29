import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { ExpenseService, type ExpenseCheckInput } from '../src/pc/service/expenseService';
import { WorkflowService } from '../src/pc/service/workflowService';

const valid: ExpenseCheckInput = {
  actorId: 'EMP-001',
  travelFormId: 'FORM-001',
  receipts: [
    { invoiceNo: 'DEMO-TRAIN-001', assetId: 'AST-003', amountCents: 30000 },
    { invoiceNo: 'DEMO-HOTEL-002', assetId: 'AST-004', amountCents: 50000 }
  ],
  lineItems: [
    { category: 'transport', invoiceNo: 'DEMO-TRAIN-001', amountCents: 30000 },
    { category: 'hotel', invoiceNo: 'DEMO-HOTEL-002', amountCents: 50000 }
  ],
  declaredTotalCents: 80000,
  idempotencyKey: 'expense-check-001'
};

it('checks ticket details and persists an auditable expense draft exactly once', () => {
  const repository = new DemoRepository();
  const service = new ExpenseService(repository);
  expect(service.validate(valid)).toEqual([]);
  const result = service.check(valid);
  expect(result).toEqual({
    expenseFormId: 'FORM-003',
    status: 'checked',
    businessVersion: 1,
    declaredTotalCents: 80000
  });
  expect(service.check(valid)).toEqual(result);
  const state = repository.snapshot();
  expect(state.expenseClaims).toEqual([
    expect.objectContaining({
      formId: 'FORM-003',
      travelFormId: 'FORM-001',
      checkedVersion: 1,
      declaredTotalCents: 80000
    })
  ]);
  expect(state.forms.find((item) => item.id === 'FORM-003')).toMatchObject({
    kind: 'expense',
    status: 'draft',
    amountCents: 80000
  });
  expect(state.auditEntries.filter((entry) => entry.entityId === 'FORM-003')).toEqual([
    expect.objectContaining({ action: 'expense-check', actorId: 'EMP-001' })
  ]);
  expect(state.todos.filter((todo) => todo.sourceId === 'FORM-003')).toEqual([]);
  expect(
    new WorkflowService(repository).transition({
      formId: 'FORM-003',
      actorId: 'EMP-001',
      action: 'submit',
      expectedVersion: 1,
      idempotencyKey: 'submit-expense-003'
    }).status
  ).toBe('submitted');
});

it('returns exact duplicate-ticket and total paths, leaving the graph unchanged on failure', () => {
  const repository = new DemoRepository();
  const service = new ExpenseService(repository);
  const before = repository.snapshot();
  const duplicate = {
    ...valid,
    receipts: [valid.receipts[0], { ...valid.receipts[1], invoiceNo: valid.receipts[0].invoiceNo }]
  };
  expect(service.validate(duplicate).map((error) => error.path)).toContainEqual(['receipts', 1, 'invoiceNo']);
  expect(() => service.check(duplicate)).toThrow('票据编号已使用');
  const mismatch = { ...valid, declaredTotalCents: 81000 };
  expect(service.validate(mismatch).map((error) => error.path)).toContainEqual(['declaredTotalCents']);
  expect(() => service.check(mismatch)).toThrow('申报总额');
  expect(() => service.check({ ...valid, actorId: 'EMP-002' })).toThrow('只有出差申请人');
  expect(repository.snapshot()).toEqual(before);

  service.check(valid);
  const saved = repository.snapshot();
  expect(service.validate({ ...valid, idempotencyKey: 'expense-check-002' }).map((error) => error.path)).toContainEqual(
    ['receipts', 0, 'invoiceNo']
  );
  expect(() => service.check({ ...valid, idempotencyKey: 'expense-check-002' })).toThrow('票据编号已使用');
  expect(() => service.check({ ...valid, declaredTotalCents: 90000 })).toThrow('幂等键已用于其他操作');
  expect(repository.snapshot()).toEqual(saved);
});
