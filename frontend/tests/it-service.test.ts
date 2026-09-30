import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { ItService } from '../src/pc/service/itService';

it('accepts a valid access request for approval without granting permission and rejects missing evidence', () => {
  const repository = new DemoRepository();
  const service = new ItService(repository);
  const input = {
    actorId: 'EMP-001',
    systemId: 'SYS-001',
    permissionId: 'PERM-001',
    materialIds: ['ACMAT-001'],
    reason: '办公查询',
    idempotencyKey: 'request-1'
  };
  const before = repository.snapshot();
  expect(service.validateRequest({ ...input, materialIds: ['ACMAT-003'] })).not.toHaveLength(0);
  expect(repository.snapshot()).toEqual(before);
  expect(service.request(input)).toMatchObject({ id: 'AREQ-001', status: 'pending', businessVersion: 1 });
  expect(service.request(input)).toMatchObject({ id: 'AREQ-001', status: 'pending' });
  expect(repository.snapshot().accessRequests).toHaveLength(1);
  expect(repository.snapshot().accessGrants).toHaveLength(0);
  expect(service.validateRequest({ ...input, reason: '改变参数' })).not.toHaveLength(0);
});

it('enforces assignment, resolution and acceptance roles and versions with complete history', () => {
  const repository = new DemoRepository();
  const service = new ItService(repository);
  const assign = {
    actorId: 'EMP-004',
    ticketId: 'TKT-001',
    assigneeId: 'EMP-006',
    expectedVersion: 1,
    idempotencyKey: 'assign-1'
  };
  expect(service.validateAssign({ ...assign, assigneeId: 'EMP-001' })).not.toHaveLength(0);
  expect(service.assign(assign)).toMatchObject({ status: 'assigned', businessVersion: 2 });
  expect(service.validateAssign({ ...assign, idempotencyKey: 'assign-2' })).not.toHaveLength(0);
  const resolve = {
    actorId: 'EMP-006',
    ticketId: 'TKT-001',
    resolution: '已排除故障。',
    expectedVersion: 2,
    idempotencyKey: 'resolve-1'
  };
  expect(service.validateResolve({ ...resolve, actorId: 'EMP-001' })).not.toHaveLength(0);
  expect(service.resolve(resolve)).toMatchObject({ status: 'resolved', businessVersion: 3 });
  const close = {
    actorId: 'EMP-001',
    ticketId: 'TKT-001',
    acceptanceNote: '已验证。',
    expectedVersion: 3,
    idempotencyKey: 'close-1'
  };
  expect(service.validateClose({ ...close, actorId: 'EMP-006' })).not.toHaveLength(0);
  expect(service.close(close)).toMatchObject({ status: 'closed', businessVersion: 4 });
  expect(service.close(close)).toMatchObject({ status: 'closed', businessVersion: 4 });
  expect(service.validateClose({ ...close, idempotencyKey: 'close-2', expectedVersion: 4 })).not.toHaveLength(0);
  expect(
    repository
      .snapshot()
      .itTicketEvents.filter((item) => item.ticketId === 'TKT-001')
      .map((item) => item.toStatus)
  ).toEqual(['assigned', 'resolved', 'closed']);
  expect(repository.snapshot().itTickets[0]).toMatchObject({
    status: 'closed',
    resolution: '已排除故障。',
    acceptanceNote: '已验证。'
  });
  expect(repository.snapshot().itOperationRecords).toHaveLength(3);
});
