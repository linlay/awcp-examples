import { expect, it } from 'vitest';

import { DemoClock } from '../src/common/fixtures/clock';
import { DemoRepository } from '../src/common/store/repository';
import { ContractService } from '../src/pc/service/contractService';

it('registers complete contract elements and binds attachments atomically', () => {
  const repository = new DemoRepository();
  const service = new ContractService(repository);
  const input = {
    actorId: 'EMP-001',
    companyId: 'COMP-001',
    counterpartyName: '虚构服务商丙',
    startDate: '2026-10-01',
    endDate: '2027-09-30',
    amountCents: 90000,
    materialIds: ['CTMAT-003'],
    idempotencyKey: 'contract-register'
  };
  const before = repository.snapshot();
  expect(() => service.register({ ...input, endDate: '2026-09-30', idempotencyKey: 'bad-range' })).toThrow();
  expect(() => service.register({ ...input, companyId: 'COMP-999', idempotencyKey: 'bad-company' })).toThrow();
  expect(() => service.register({ ...input, amountCents: 0, idempotencyKey: 'bad-amount' })).toThrow();
  expect(() => service.register({ ...input, materialIds: ['CTMAT-001'], idempotencyKey: 'busy-material' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  const result = service.register(input);
  expect(result).toMatchObject({ id: 'CNTR-003', status: 'registered', businessVersion: 1 });
  expect(service.register(input)).toEqual(result);
  expect(repository.snapshot().contractMaterials.find((item) => item.id === 'CTMAT-003')?.contractId).toBe('CNTR-003');
  expect(repository.snapshot().officeContracts[2]).toMatchObject({
    companyId: 'COMP-001',
    counterpartyName: '虚构服务商丙',
    amountCents: 90000,
    materialIds: ['CTMAT-003'],
    startDate: '2026-10-01',
    endDate: '2027-09-30'
  });
  expect(() =>
    service.register({ ...input, counterpartyName: '不同', idempotencyKey: input.idempotencyKey })
  ).toThrow();
});

it('keeps seal submission pending until a reviewer approves, then checks current materials at execution', () => {
  const repository = new DemoRepository();
  const service = new ContractService(repository);
  const submit = {
    actorId: 'EMP-001',
    contractId: 'CNTR-001',
    contractVersion: 1,
    purpose: '虚构签署用印',
    materialIds: ['CTMAT-001'],
    idempotencyKey: 'seal-submit'
  };
  const before = repository.snapshot();
  expect(() =>
    service.submit({
      ...submit,
      contractId: 'CNTR-002',
      materialIds: ['CTMAT-002'],
      idempotencyKey: 'expired-material'
    })
  ).toThrow();
  expect(() => service.submit({ ...submit, contractVersion: 9, idempotencyKey: 'stale-contract' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  const submitted = service.submit(submit);
  expect(submitted).toMatchObject({ id: 'SEAL-003', status: 'pending', businessVersion: 1 });
  expect(() =>
    service.execute({ actorId: 'EMP-001', sealId: submitted.id, expectedVersion: 1, idempotencyKey: 'seal-premature' })
  ).toThrow();
  const review = {
    actorId: 'EMP-004',
    sealId: submitted.id,
    decision: 'approved' as const,
    note: '虚构审批同意。',
    expectedVersion: 1,
    idempotencyKey: 'seal-review'
  };
  expect(() => service.review({ ...review, actorId: 'EMP-001', idempotencyKey: 'self-review' })).toThrow();
  expect(() => service.review({ ...review, expectedVersion: 2, idempotencyKey: 'stale-review' })).toThrow();
  expect(service.review(review)).toMatchObject({ id: submitted.id, status: 'approved', businessVersion: 2 });
  const executed = service.execute({
    actorId: 'EMP-001',
    sealId: submitted.id,
    expectedVersion: 2,
    idempotencyKey: 'seal-execute'
  });
  expect(executed).toMatchObject({ id: submitted.id, status: 'executed', businessVersion: 3 });
  expect(repository.snapshot().sealRequests[2]).toMatchObject({
    reviewerId: 'EMP-004',
    decisionNote: '虚构审批同意。',
    status: 'executed'
  });
});

it('finds expiry from the fixed clock and creates a linked renewal without overwriting source version', () => {
  const repository = new DemoRepository();
  const service = new ContractService(repository);
  const view = service.read({ actorId: 'EMP-001' });
  expect(view.today).toBe('2026-09-19');
  expect(view.expiring).toEqual([expect.objectContaining({ id: 'CNTR-001', daysUntilExpiry: 6 })]);
  const input = {
    actorId: 'EMP-001',
    sourceContractId: 'CNTR-001',
    sourceVersion: 1,
    startDate: '2026-09-26',
    endDate: '2027-09-25',
    amountCents: 130000,
    materialIds: ['CTMAT-004'],
    idempotencyKey: 'renew-contract'
  };
  const before = repository.snapshot();
  expect(() => service.renew({ ...input, startDate: '2026-09-25', idempotencyKey: 'overlap' })).toThrow();
  expect(() => service.renew({ ...input, sourceContractId: 'CNTR-002', idempotencyKey: 'too-early' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  const result = service.renew(input);
  expect(result).toMatchObject({ id: 'CNTR-003', status: 'registered', businessVersion: 1 });
  expect(service.renew(input)).toEqual(result);
  expect(repository.snapshot().officeContracts[0]).toEqual(before.officeContracts[0]);
  expect(repository.snapshot().officeContracts[2]).toMatchObject({
    renewedFromContractId: 'CNTR-001',
    sourceVersion: 1,
    startDate: '2026-09-26',
    endDate: '2027-09-25',
    amountCents: 130000
  });
  expect(() => service.renew({ ...input, idempotencyKey: 'duplicate-renewal' })).toThrow();
});

it('does not execute a previously approved seal once its contract expires', () => {
  const clock = new DemoClock();
  const repository = new DemoRepository({ clock });
  const service = new ContractService(repository);
  clock.advanceBy(7 * 86_400_000);
  expect(() =>
    service.execute({
      actorId: 'EMP-001',
      sealId: 'SEAL-002',
      expectedVersion: 2,
      idempotencyKey: 'expired-contract-execution'
    })
  ).toThrow();
  expect(repository.snapshot().sealRequests[1].status).toBe('approved');
});

it('rechecks material validity when executing an already approved seal', () => {
  const repository = new DemoRepository();
  repository.transact((state) => {
    const material = state.contractMaterials.find((item) => item.id === 'CTMAT-001');
    if (!material) throw new Error('Missing fixed contract material.');
    material.expiresOn = '2026-09-18';
  });
  const service = new ContractService(repository);
  const before = repository.snapshot();
  expect(() =>
    service.execute({
      actorId: 'EMP-001',
      sealId: 'SEAL-002',
      expectedVersion: 2,
      idempotencyKey: 'expired-material-execution'
    })
  ).toThrow();
  expect(repository.snapshot()).toEqual(before);
});
