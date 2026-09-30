import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { AdminService } from '../src/pc/service/adminService';

it('synchronizes equipment status and holder across assignment and return without duplicate allocation', () => {
  const repository = new DemoRepository();
  const service = new AdminService(repository);
  const assign = {
    actorId: 'EMP-002',
    assetId: 'EQ-001',
    holderId: 'EMP-003',
    expectedVersion: 1,
    idempotencyKey: 'admin-assign'
  };
  const before = repository.snapshot();
  expect(() => service.assign({ ...assign, actorId: 'EMP-001', idempotencyKey: 'not-manager' })).toThrow();
  expect(() =>
    service.assign({ ...assign, assetId: 'EQ-002', expectedVersion: 2, idempotencyKey: 'occupied' })
  ).toThrow();
  expect(() => service.assign({ ...assign, holderId: 'EMP-012', idempotencyKey: 'inactive-holder' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  expect(service.assign(assign)).toMatchObject({ id: 'EQ-001', status: 'assigned', businessVersion: 2 });
  expect(service.assign(assign)).toMatchObject({ id: 'EQ-001', status: 'assigned', businessVersion: 2 });
  expect(repository.snapshot().adminAssets[0]).toMatchObject({ holderId: 'EMP-003', status: 'assigned' });
  expect(service.read({ actorId: 'EMP-001' }).holdings).toEqual(
    expect.arrayContaining([expect.objectContaining({ employeeId: 'EMP-003', assetIds: ['EQ-001', 'EQ-002'] })])
  );
  expect(() => service.assign({ ...assign, idempotencyKey: 'duplicate-allocation', expectedVersion: 2 })).toThrow();
  expect(() =>
    service.returnAsset({ actorId: 'EMP-001', assetId: 'EQ-001', expectedVersion: 2, idempotencyKey: 'wrong-returner' })
  ).toThrow();
  const returned = service.returnAsset({
    actorId: 'EMP-003',
    assetId: 'EQ-001',
    expectedVersion: 2,
    idempotencyKey: 'admin-return'
  });
  expect(returned).toMatchObject({ id: 'EQ-001', status: 'available', businessVersion: 3 });
  expect(repository.snapshot().adminAssets[0].holderId).toBeNull();
  expect(repository.snapshot().assetMovements.at(-1)).toMatchObject({ action: 'return', holderId: 'EMP-003' });
});

it('validates room and vehicle rules and admits only one competing reservation', async () => {
  const repository = new DemoRepository();
  const service = new AdminService(repository);
  const room = {
    actorId: 'EMP-001',
    resourceId: 'RES-001',
    participantIds: ['EMP-001', 'EMP-003'],
    driverId: null,
    startAt: '2026-09-21T02:00:00.000Z',
    endAt: '2026-09-21T03:00:00.000Z',
    idempotencyKey: 'room-first'
  };
  const before = repository.snapshot();
  expect(() =>
    service.reserve({
      ...room,
      startAt: '2026-09-20T02:30:00.000Z',
      endAt: '2026-09-20T03:30:00.000Z',
      idempotencyKey: 'seed-overlap'
    })
  ).toThrow();
  expect(() => service.reserve({ ...room, resourceId: 'RES-002', idempotencyKey: 'no-driver' })).toThrow();
  expect(() =>
    service.reserve({ ...room, participantIds: ['EMP-001', 'EMP-012'], idempotencyKey: 'inactive-person' })
  ).toThrow();
  expect(repository.snapshot()).toEqual(before);
  const competing = await Promise.allSettled([
    Promise.resolve().then(() => service.reserve(room)),
    Promise.resolve().then(() => service.reserve({ ...room, actorId: 'EMP-003', idempotencyKey: 'room-second' }))
  ]);
  expect(competing.map((item) => item.status).sort()).toEqual(['fulfilled', 'rejected']);
  expect(repository.snapshot().resourceReservations.filter((item) => item.resourceId === 'RES-001')).toHaveLength(2);
  expect(service.reserve(room)).toMatchObject({ id: 'RSV-002', status: 'reserved' });
  const vehicle = service.reserve({
    actorId: 'EMP-001',
    resourceId: 'RES-002',
    participantIds: ['EMP-001', 'EMP-002'],
    driverId: 'EMP-002',
    startAt: '2026-09-21T02:00:00.000Z',
    endAt: '2026-09-21T05:00:00.000Z',
    idempotencyKey: 'vehicle'
  });
  expect(vehicle).toMatchObject({ id: 'RSV-003', status: 'reserved' });
  expect(repository.snapshot().resourceReservations[2]).toMatchObject({ driverId: 'EMP-002' });
});

it('requires a real resolution before reporter acceptance and restores the linked asset', () => {
  const repository = new DemoRepository();
  const service = new AdminService(repository);
  const resolve = {
    actorId: 'EMP-004',
    ticketId: 'REP-001',
    resolution: '已更换虚构进纸组件并测试。',
    expectedVersion: 1,
    idempotencyKey: 'repair-resolve'
  };
  const before = repository.snapshot();
  expect(() => service.resolve({ ...resolve, resolution: ' ', idempotencyKey: 'empty-opinion' })).toThrow();
  expect(() => service.resolve({ ...resolve, actorId: 'EMP-001', idempotencyKey: 'wrong-repairer' })).toThrow();
  expect(() =>
    service.accept({ actorId: 'EMP-001', ticketId: 'REP-001', expectedVersion: 1, idempotencyKey: 'premature-accept' })
  ).toThrow();
  expect(repository.snapshot()).toEqual(before);
  expect(service.resolve(resolve)).toMatchObject({ id: 'REP-001', status: 'resolved', businessVersion: 2 });
  expect(repository.snapshot().adminAssets[2].status).toBe('repair');
  expect(() =>
    service.accept({ actorId: 'EMP-004', ticketId: 'REP-001', expectedVersion: 2, idempotencyKey: 'wrong-reporter' })
  ).toThrow();
  expect(
    service.accept({ actorId: 'EMP-001', ticketId: 'REP-001', expectedVersion: 2, idempotencyKey: 'repair-accept' })
  ).toMatchObject({ id: 'REP-001', status: 'accepted', businessVersion: 3 });
  expect(repository.snapshot().adminAssets[2]).toMatchObject({ status: 'available', holderId: null });
  expect(repository.snapshot().repairTickets[0]).toMatchObject({
    resolution: '已更换虚构进纸组件并测试。',
    status: 'accepted'
  });
});

it('cannot close a resolved ticket whose processing opinion is missing', () => {
  const repository = new DemoRepository();
  repository.transact((state) => {
    state.repairTickets[1].resolution = null;
  });
  const service = new AdminService(repository);
  const before = repository.snapshot();
  expect(() =>
    service.accept({ actorId: 'EMP-001', ticketId: 'REP-002', expectedVersion: 2, idempotencyKey: 'no-repair-opinion' })
  ).toThrow();
  expect(repository.snapshot()).toEqual(before);
});
