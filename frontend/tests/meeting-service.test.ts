import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { MeetingService } from '../src/pc/service/meetingService';
import { TodoService } from '../src/pc/service/todoService';

const freeSlot = {
  actorId: 'EMP-001',
  participantIds: ['EMP-001', 'EMP-002'],
  resourceId: 'ROOM-001',
  startAt: '2026-09-19T05:00:00.000Z',
  endAt: '2026-09-19T06:00:00.000Z'
};

it('reports specific person and room conflicts, then reserves a free shared slot once', () => {
  const repository = new DemoRepository();
  const service = new MeetingService(repository);
  expect(
    service.availability({
      actorId: 'EMP-001',
      participantIds: ['EMP-003'],
      resourceId: 'ROOM-001',
      startAt: '2026-09-19T02:00:00.000Z',
      endAt: '2026-09-19T03:00:00.000Z'
    })
  ).toEqual({
    available: false,
    conflicts: [
      { meetingId: 'MTG-001', objectType: 'resource', objectId: 'ROOM-001' },
      { meetingId: 'MTG-002', objectType: 'participant', objectId: 'EMP-003' }
    ]
  });
  expect(service.availability(freeSlot)).toEqual({ available: true, conflicts: [] });
  const initial = repository.snapshot();
  const conflict = {
    ...freeSlot,
    startAt: '2026-09-19T02:30:00.000Z',
    endAt: '2026-09-19T03:30:00.000Z',
    title: '冲突会议',
    idempotencyKey: 'meeting-conflict'
  };
  expect(service.validateReserve(conflict)).toEqual([
    expect.objectContaining({ path: ['startAt'], messages: [expect.stringContaining('MTG-001')] })
  ]);
  expect(() => service.reserve(conflict)).toThrow('MTG-001');
  expect(repository.snapshot()).toEqual(initial);
  const args = { ...freeSlot, title: '虚构协调会', idempotencyKey: 'reserve-free' };
  expect(service.reserve(args)).toEqual({ meetingId: 'MTG-004', status: 'reserved', businessVersion: 1 });
  expect(service.reserve(args).meetingId).toBe('MTG-004');
  expect(repository.snapshot().meetings).toHaveLength(4);
  expect(service.availability(freeSlot).conflicts).toEqual([
    { meetingId: 'MTG-004', objectType: 'resource', objectId: 'ROOM-001' },
    { meetingId: 'MTG-004', objectType: 'participant', objectId: 'EMP-001' },
    { meetingId: 'MTG-004', objectType: 'participant', objectId: 'EMP-002' }
  ]);
  expect(service.validateReserve({ ...args, idempotencyKey: 'reserve-again' })).toHaveLength(1);
  expect(
    service.validateReserve({ ...args, participantIds: ['EMP-001', 'EMP-012'], idempotencyKey: 'inactive' })
  ).toHaveLength(1);
});

it('reschedules with a versioned simulated notice, releases old time, and rejects conflicts atomically', () => {
  const repository = new DemoRepository();
  const service = new MeetingService(repository);
  const conflicting = {
    actorId: 'EMP-001',
    meetingId: 'MTG-001',
    resourceId: 'ROOM-002',
    startAt: '2026-09-19T02:00:00.000Z',
    endAt: '2026-09-19T03:00:00.000Z',
    expectedVersion: 1,
    idempotencyKey: 'move-conflict'
  };
  const initial = repository.snapshot();
  expect(service.validateReschedule(conflicting)).toEqual([
    expect.objectContaining({ path: ['startAt'], messages: [expect.stringContaining('MTG-002')] })
  ]);
  expect(() => service.reschedule(conflicting)).toThrow('MTG-002');
  expect(repository.snapshot()).toEqual(initial);
  const args = {
    ...conflicting,
    resourceId: 'ROOM-001',
    startAt: '2026-09-19T04:00:00.000Z',
    endAt: '2026-09-19T05:00:00.000Z',
    idempotencyKey: 'move-free'
  };
  expect(service.reschedule(args)).toEqual({ meetingId: 'MTG-001', status: 'reserved', businessVersion: 2 });
  expect(service.reschedule(args).businessVersion).toBe(2);
  expect(service.read({ actorId: 'EMP-001', meetingId: 'MTG-001' })).toMatchObject({
    startAt: args.startAt,
    businessVersion: 2,
    notifications: [
      expect.objectContaining({
        previousStartAt: '2026-09-19T02:00:00.000Z',
        startAt: args.startAt,
        recipientIds: ['EMP-001', 'EMP-002'],
        status: 'simulated'
      })
    ]
  });
  expect(
    service.availability({
      actorId: 'EMP-001',
      participantIds: ['EMP-001', 'EMP-002'],
      resourceId: 'ROOM-001',
      startAt: '2026-09-19T02:00:00.000Z',
      endAt: '2026-09-19T03:00:00.000Z'
    })
  ).toEqual({ available: true, conflicts: [] });
  expect(service.validateReschedule({ ...args, expectedVersion: 1, idempotencyKey: 'old-version' })).toContainEqual(
    expect.objectContaining({ path: ['expectedVersion'] })
  );
  expect(repository.snapshot().meetingNotifications).toHaveLength(1);
});

it('records structured minutes once and exposes meeting action items in O01', () => {
  const repository = new DemoRepository();
  const service = new MeetingService(repository);
  const args = {
    actorId: 'EMP-003',
    meetingId: 'MTG-003',
    expectedVersion: 1,
    attendeeIds: ['EMP-003', 'EMP-004'],
    agenda: '虚构晨会资料检查',
    decisions: ['按演示流程确认资料。'],
    actionItems: [{ title: '整理虚构晨会资料', assigneeId: 'EMP-004', dueAt: '2026-09-19T08:00:00.000Z' }],
    idempotencyKey: 'minutes-valid'
  };
  const initial = repository.snapshot();
  expect(
    service.validateMinutes({
      ...args,
      actionItems: [{ ...args.actionItems[0], title: '' }],
      idempotencyKey: 'minutes-empty'
    })
  ).toEqual([expect.objectContaining({ path: ['actionItems', 0, 'title'] })]);
  expect(() =>
    service.saveMinutes({
      ...args,
      actionItems: [{ ...args.actionItems[0], title: '' }],
      idempotencyKey: 'minutes-empty'
    })
  ).toThrow();
  expect(repository.snapshot()).toEqual(initial);
  expect(service.saveMinutes(args)).toEqual({ meetingId: 'MTG-003', status: 'minutes-recorded', businessVersion: 2 });
  expect(service.saveMinutes(args).businessVersion).toBe(2);
  expect(service.read({ actorId: 'EMP-004', meetingId: 'MTG-003' })).toMatchObject({
    minutes: {
      attendeeIds: ['EMP-003', 'EMP-004'],
      agenda: args.agenda,
      decisions: args.decisions,
      templateLabel: '虚构会议纪要模板',
      meetingVersion: 2,
      actionItems: [expect.objectContaining({ todoId: 'OTODO-003', sourceType: 'meeting', sourceId: 'MTG-003' })]
    }
  });
  expect(new TodoService(repository).query({ actorId: 'EMP-004' }).items).toContainEqual(
    expect.objectContaining({ todoId: 'OTODO-003', sourceType: 'meeting', sourceId: 'MTG-003', canComplete: false })
  );
  expect(service.validateMinutes({ ...args, expectedVersion: 2, idempotencyKey: 'minutes-again' })).toHaveLength(1);
  expect(service.validateMinutes({ ...args, actorId: 'EMP-004', idempotencyKey: 'not-organizer' })).not.toEqual([]);
  expect(repository.snapshot().meetingMinutes).toHaveLength(1);
  expect(repository.snapshot().todos.filter((item) => item.sourceType === 'meeting')).toHaveLength(1);
});
