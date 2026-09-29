import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { ProcurementService } from '../src/pc/service/procurementService';

it('creates purchases and computes the cheapest approved supplier from reproducible totals', () => {
  const repository = new DemoRepository();
  const service = new ProcurementService(repository);
  const created = service.create({
    actorId: 'EMP-001',
    itemName: '虚构显示器',
    quantity: 3,
    idempotencyKey: 'p-create'
  });
  expect(created).toMatchObject({ id: 'PREQ-003', status: 'draft', businessVersion: 1 });
  expect(
    service.create({ actorId: 'EMP-001', itemName: '虚构显示器', quantity: 3, idempotencyKey: 'p-create' })
  ).toEqual(created);
  const before = repository.snapshot();
  expect(() =>
    service.create({ actorId: 'EMP-001', itemName: '无效', quantity: 0, idempotencyKey: 'p-bad-qty' })
  ).toThrow();
  expect(() =>
    service.create({ actorId: 'EMP-001', itemName: '其他', quantity: 3, idempotencyKey: 'p-create' })
  ).toThrow();
  expect(() =>
    service.compare({
      actorId: 'EMP-001',
      requestId: created.id,
      quotes: [
        { supplierId: 'SUP-001', unitPriceCents: 1000 },
        { supplierId: 'SUP-003', unitPriceCents: 800 }
      ],
      expectedVersion: 1,
      idempotencyKey: 'p-pending'
    })
  ).toThrow();
  expect(() =>
    service.compare({
      actorId: 'EMP-001',
      requestId: created.id,
      quotes: [
        { supplierId: 'SUP-001', unitPriceCents: 0 },
        { supplierId: 'SUP-002', unitPriceCents: 800 }
      ],
      expectedVersion: 1,
      idempotencyKey: 'p-zero-price'
    })
  ).toThrow();
  expect(repository.snapshot()).toEqual(before);
  const comparison = service.compare({
    actorId: 'EMP-001',
    requestId: created.id,
    quotes: [
      { supplierId: 'SUP-001', unitPriceCents: 1000 },
      { supplierId: 'SUP-002', unitPriceCents: 800 }
    ],
    expectedVersion: 1,
    idempotencyKey: 'p-compare'
  });
  expect(comparison).toMatchObject({ id: 'PCMP-002', status: 'selected', businessVersion: 2 });
  expect(repository.snapshot().purchaseComparisons[1]).toMatchObject({
    selectedSupplierId: 'SUP-002',
    selectedTotalCents: 2400,
    quotes: [
      { supplierId: 'SUP-001', unitPriceCents: 1000, totalCents: 3000 },
      { supplierId: 'SUP-002', unitPriceCents: 800, totalCents: 2400 }
    ]
  });
  expect(repository.snapshot().purchaseRequests[2]).toMatchObject({ totalCents: 2400, unitPriceCents: 800 });
});

it('requires reviewer, current version, owned proofs and unexpired registration plus tax proof', () => {
  const repository = new DemoRepository();
  const service = new ProcurementService(repository);
  const input = {
    actorId: 'EMP-004',
    supplierId: 'SUP-003',
    decision: 'approved' as const,
    proofIds: ['SPRF-005', 'SPRF-006'],
    note: '资料核对完成。',
    expectedVersion: 1,
    idempotencyKey: 'p-review'
  };
  const before = repository.snapshot();
  expect(() => service.review({ ...input, actorId: 'EMP-001', idempotencyKey: 'p-wrong-reviewer' })).toThrow();
  expect(() =>
    service.review({ ...input, supplierId: 'SUP-004', proofIds: ['SPRF-007'], idempotencyKey: 'p-expired' })
  ).toThrow();
  expect(() => service.review({ ...input, proofIds: ['SPRF-005'], idempotencyKey: 'p-missing-tax' })).toThrow();
  expect(() => service.review({ ...input, expectedVersion: 9, idempotencyKey: 'p-stale-review' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  const reviewed = service.review(input);
  expect(reviewed).toMatchObject({ id: 'SREV-001', status: 'approved', businessVersion: 2 });
  expect(service.review(input)).toEqual(reviewed);
  expect(repository.snapshot().procurementSuppliers[2].status).toBe('approved');
  expect(repository.snapshot().supplierReviews[0]).toMatchObject({ proofIds: ['SPRF-005', 'SPRF-006'] });
});

it('accepts partial receipts into inventory but rejects excess, duplicate and unrelated actors', () => {
  const repository = new DemoRepository();
  const service = new ProcurementService(repository);
  const first = { actorId: 'EMP-001', requestId: 'PREQ-002', quantity: 2, idempotencyKey: 'p-receipt-1' };
  const result = service.accept(first);
  expect(result).toMatchObject({ id: 'PREC-001', status: 'accepted' });
  expect(service.accept(first)).toEqual(result);
  expect(repository.snapshot().inventoryEntries[0]).toMatchObject({
    receiptId: 'PREC-001',
    requestId: 'PREQ-002',
    quantity: 2,
    unitPriceCents: 1200,
    totalCents: 2400
  });
  const before = repository.snapshot();
  expect(() => service.accept({ ...first, quantity: 3, idempotencyKey: 'p-too-many' })).toThrow();
  expect(() => service.accept({ ...first, actorId: 'EMP-002', idempotencyKey: 'p-other-actor' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  service.accept({ ...first, quantity: 2, idempotencyKey: 'p-receipt-2' });
  expect(repository.snapshot().inventoryEntries.reduce((sum, item) => sum + item.quantity, 0)).toBe(4);
  expect(service.read({ actorId: 'EMP-001' }).requests).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'PREQ-002', receivedQuantity: 4 })])
  );
  expect(() => service.accept({ ...first, quantity: 1, idempotencyKey: 'p-exhausted' })).toThrow();
});
