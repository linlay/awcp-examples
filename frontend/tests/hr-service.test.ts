import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { HrService } from '../src/pc/service/hrService';

it('validates leave balance and attendance periods before saving employee-linked requests', () => {
  const repository = new DemoRepository();
  const service = new HrService(repository);
  const leave = {
    actorId: 'EMP-001',
    employeeId: 'EMP-001',
    startDate: '2026-09-22',
    endDate: '2026-09-23',
    reason: '虚构休假安排。',
    idempotencyKey: 'o10-leave'
  };
  const initial = repository.snapshot();
  expect(service.validateLeave({ ...leave, endDate: '2026-09-30', idempotencyKey: 'o10-over-balance' })).toContainEqual(
    expect.objectContaining({ path: ['endDate'], messages: [expect.stringContaining('余额不足')] })
  );
  expect(service.validateLeave({ ...leave, startDate: '2026-09-18', idempotencyKey: 'o10-past' })).toContainEqual(
    expect.objectContaining({ path: ['startDate'] })
  );
  expect(() => service.submitLeave({ ...leave, endDate: '2026-09-30', idempotencyKey: 'o10-over-balance' })).toThrow();
  expect(repository.snapshot()).toEqual(initial);
  expect(service.submitLeave(leave)).toEqual({
    id: 'LREQ-001',
    employeeId: 'EMP-001',
    status: 'submitted',
    businessVersion: 1
  });
  expect(service.submitLeave(leave).id).toBe('LREQ-001');
  expect(service.read({ actorId: 'EMP-001', employeeId: 'EMP-001' })).toMatchObject({
    remainingLeaveDays: 3,
    leaveRequests: [{ id: 'LREQ-001', days: 2 }]
  });
  expect(
    service.validateLeave({ ...leave, startDate: '2026-09-23', endDate: '2026-09-24', idempotencyKey: 'o10-overlap' })
  ).toContainEqual(expect.objectContaining({ path: ['startDate'], messages: [expect.stringContaining('重叠')] }));
  const attendance = {
    actorId: 'EMP-001',
    employeeId: 'EMP-001',
    date: '2026-09-18',
    checkIn: '09:00',
    checkOut: '18:00',
    reason: '虚构补卡说明。',
    idempotencyKey: 'o10-correction'
  };
  expect(
    service.validateAttendance({ ...attendance, checkOut: '08:00', idempotencyKey: 'o10-invalid-time' })
  ).toContainEqual(expect.objectContaining({ path: ['checkOut'] }));
  expect(service.correctAttendance(attendance)).toEqual({
    id: 'ATCOR-001',
    employeeId: 'EMP-001',
    status: 'submitted',
    businessVersion: 1
  });
  expect(service.validateAttendance({ ...attendance, idempotencyKey: 'o10-duplicate-date' })).toContainEqual(
    expect.objectContaining({ path: ['date'] })
  );
  expect(service.read({ actorId: 'EMP-001', employeeId: 'EMP-001' })).toMatchObject({
    attendanceCorrections: [{ id: 'ATCOR-001', date: '2026-09-18', checkIn: '09:00', checkOut: '18:00' }]
  });
});

it('requires type-specific personnel materials, archives before-and-after changes and applies them', () => {
  const repository = new DemoRepository();
  const service = new HrService(repository);
  const transfer = {
    actorId: 'EMP-004',
    employeeId: 'EMP-003',
    kind: 'transfer' as const,
    targetDepartmentId: 'DEP-001',
    targetPosition: null,
    materialIds: ['PMAT-003'],
    expectedVersion: 1,
    idempotencyKey: 'o10-transfer'
  };
  const before = repository.snapshot();
  expect(
    service.validatePersonnel({ ...transfer, materialIds: [], idempotencyKey: 'o10-missing-transfer-order' })
  ).toContainEqual(expect.objectContaining({ path: ['materialIds'], messages: [expect.stringContaining('缺少')] }));
  expect(service.validatePersonnel({ ...transfer, actorId: 'EMP-001', idempotencyKey: 'o10-wrong-hr' })).toContainEqual(
    expect.objectContaining({ path: ['actorId'] })
  );
  expect(() =>
    service.processPersonnel({ ...transfer, materialIds: [], idempotencyKey: 'o10-missing-transfer-order' })
  ).toThrow();
  expect(repository.snapshot()).toEqual(before);
  expect(service.processPersonnel(transfer)).toEqual({
    id: 'PCASE-001',
    employeeId: 'EMP-003',
    status: 'archived',
    businessVersion: 2
  });
  expect(service.processPersonnel(transfer).id).toBe('PCASE-001');
  expect(service.read({ actorId: 'EMP-004', employeeId: 'EMP-003' })).toMatchObject({
    departmentId: 'DEP-001',
    personnelVersion: 2,
    personnelHistory: [
      {
        id: 'PCASE-001',
        kind: 'transfer',
        beforeDepartmentId: 'DEP-002',
        afterDepartmentId: 'DEP-001',
        materialIds: ['PMAT-003']
      }
    ]
  });
  expect(service.validatePersonnel({ ...transfer, idempotencyKey: 'o10-stale' })).toContainEqual(
    expect.objectContaining({ path: ['expectedVersion'] })
  );
  expect(
    service.processPersonnel({
      actorId: 'EMP-004',
      employeeId: 'EMP-012',
      kind: 'onboard',
      targetDepartmentId: 'DEP-003',
      targetPosition: null,
      materialIds: ['PMAT-001', 'PMAT-002'],
      expectedVersion: 1,
      idempotencyKey: 'o10-onboard'
    })
  ).toMatchObject({ id: 'PCASE-002', businessVersion: 2 });
  expect(repository.snapshot().employees.find((item) => item.id === 'EMP-012')?.active).toBe(true);
  expect(
    service.processPersonnel({
      actorId: 'EMP-004',
      employeeId: 'EMP-012',
      kind: 'offboard',
      targetDepartmentId: null,
      targetPosition: null,
      materialIds: ['PMAT-005'],
      expectedVersion: 2,
      idempotencyKey: 'o10-offboard'
    })
  ).toMatchObject({ id: 'PCASE-003', businessVersion: 3 });
  expect(repository.snapshot().employees.find((item) => item.id === 'EMP-012')?.active).toBe(false);
  expect(service.read({ actorId: 'EMP-004', employeeId: 'EMP-012' })).toMatchObject({
    personnelHistory: [{ kind: 'onboard' }, { kind: 'offboard' }]
  });
});

it('tracks training capacity, deduplicates enrollment and records completion by HR', () => {
  const repository = new DemoRepository();
  const service = new HrService(repository);
  const enroll = { actorId: 'EMP-001', employeeId: 'EMP-001', courseId: 'TRN-001', idempotencyKey: 'o10-enroll-1' };
  expect(service.queryTraining({ actorId: 'EMP-001', employeeId: 'EMP-001', courseId: 'TRN-001' })).toMatchObject({
    courses: [{ courseId: 'TRN-001', capacity: 2, enrolledCount: 0, available: 2, enrollment: null }]
  });
  expect(service.enroll(enroll)).toEqual({
    id: 'ENR-002',
    employeeId: 'EMP-001',
    status: 'enrolled',
    businessVersion: 1
  });
  expect(service.enroll({ ...enroll, idempotencyKey: 'o10-enroll-again' }).id).toBe('ENR-002');
  expect(
    service.enroll({ actorId: 'EMP-002', employeeId: 'EMP-002', courseId: 'TRN-001', idempotencyKey: 'o10-enroll-2' })
      .id
  ).toBe('ENR-003');
  const before = repository.snapshot();
  expect(
    service.validateEnroll({
      actorId: 'EMP-003',
      employeeId: 'EMP-003',
      courseId: 'TRN-001',
      idempotencyKey: 'o10-full'
    })
  ).toContainEqual(expect.objectContaining({ path: ['courseId'] }));
  expect(() =>
    service.enroll({ actorId: 'EMP-003', employeeId: 'EMP-003', courseId: 'TRN-001', idempotencyKey: 'o10-full' })
  ).toThrow();
  expect(repository.snapshot()).toEqual(before);
  expect(service.queryTraining({ actorId: 'EMP-001', employeeId: 'EMP-001', courseId: 'TRN-001' })).toMatchObject({
    courses: [{ capacity: 2, enrolledCount: 2, available: 0, enrollment: { id: 'ENR-002', status: 'enrolled' } }]
  });
  const complete = {
    actorId: 'EMP-004',
    employeeId: 'EMP-001',
    courseId: 'TRN-001',
    expectedVersion: 1,
    idempotencyKey: 'o10-complete'
  };
  expect(
    service.validateComplete({ ...complete, actorId: 'EMP-002', idempotencyKey: 'o10-wrong-recorder' })
  ).toContainEqual(expect.objectContaining({ path: ['actorId'] }));
  expect(service.complete(complete)).toEqual({
    id: 'ENR-002',
    employeeId: 'EMP-001',
    status: 'completed',
    businessVersion: 2
  });
  expect(service.complete(complete).businessVersion).toBe(2);
  expect(service.queryTraining({ actorId: 'EMP-001', employeeId: 'EMP-001', courseId: 'TRN-001' })).toMatchObject({
    courses: [
      {
        enrolledCount: 2,
        available: 0,
        enrollment: { status: 'completed', businessVersion: 2, completedBy: 'EMP-004' }
      }
    ]
  });
  expect(repository.snapshot().trainingEnrollments).toHaveLength(3);
});
