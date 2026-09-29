import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { InstitutionService } from '../src/pc/service/institutionService';
import { MeetingService } from '../src/pc/service/meetingService';

const reserve = {
  actorId: 'EMP-002',
  needId: 'SNEED-001',
  resourceId: 'ROOM-001',
  startAt: '2026-09-20T04:00:00.000Z',
  endAt: '2026-09-20T05:00:00.000Z',
  expectedVersion: 1,
  idempotencyKey: 'reserve-1'
};

it('creates shared meeting, approved document package, simulated invite, minutes and followup', () => {
  const repository = new DemoRepository();
  const service = new InstitutionService(repository);
  expect(service.query({ actorId: 'EMP-001', institutionId: 'INST-001' })).toMatchObject({
    profile: { clientId: 'CLI-001', projectId: 'PRJ-001', contactGroupId: 'CGROUP-001' },
    needs: [expect.anything(), expect.anything(), expect.anything()]
  });
  expect(service.entitlement({ actorId: 'EMP-001', needId: 'SNEED-001' })).toMatchObject({
    eligible: true,
    policyVersion: 1,
    reasons: []
  });
  expect(service.reserve(reserve)).toMatchObject({
    needId: 'SNEED-001',
    status: 'reserved',
    businessVersion: 2,
    roadshowId: 'RDS-001'
  });
  expect(service.reserve(reserve)).toMatchObject({ status: 'reserved', businessVersion: 2 });
  expect(repository.snapshot().meetings.find((item) => item.id === 'MTG-004')).toMatchObject({
    organizerId: 'EMP-002',
    participantIds: ['EMP-001', 'EMP-003', 'EMP-002']
  });
  expect(
    service.createPackage({
      actorId: 'EMP-003',
      needId: 'SNEED-001',
      materialIds: ['SMAT-001'],
      expectedVersion: 2,
      idempotencyKey: 'package-1'
    })
  ).toMatchObject({ status: 'packaged', businessVersion: 3 });
  expect(repository.snapshot().institutionMaterialPackages[0]).toMatchObject({
    documentRefs: [{ documentId: 'DOC-002', version: 1 }],
    policyVersion: 1
  });
  expect(
    service.invite({ actorId: 'EMP-002', needId: 'SNEED-001', expectedVersion: 3, idempotencyKey: 'invite-1' })
  ).toMatchObject({ status: 'invited', businessVersion: 4 });
  expect(repository.snapshot().roadshowInvitations[0]).toMatchObject({ status: 'simulated', meetingId: 'MTG-004' });
  expect(repository.snapshot().mailSendRecords).toHaveLength(0);
  expect(
    service.validateMinutes({
      actorId: 'EMP-002',
      needId: 'SNEED-001',
      agenda: '演示议程',
      decisions: ['演示结论'],
      expectedVersion: 4,
      idempotencyKey: 'early-minutes'
    })
  ).not.toHaveLength(0);
  repository.clock.advanceBy(30 * 3_600_000);
  expect(
    service.recordMinutes({
      actorId: 'EMP-002',
      needId: 'SNEED-001',
      agenda: '演示议程',
      decisions: ['演示结论'],
      expectedVersion: 4,
      idempotencyKey: 'minutes-1'
    })
  ).toMatchObject({ status: 'minutes-recorded', businessVersion: 5 });
  expect(new MeetingService(repository).read({ actorId: 'EMP-001', meetingId: 'MTG-004' })).toMatchObject({
    minutes: { id: 'MMIN-001', agenda: '演示议程' }
  });
  expect(
    service.followup({
      actorId: 'EMP-001',
      needId: 'SNEED-001',
      note: '机构反馈良好。',
      outcome: 'satisfied',
      expectedVersion: 5,
      idempotencyKey: 'followup-1'
    })
  ).toMatchObject({ status: 'completed', businessVersion: 6 });
  expect(service.summary({ actorId: 'EMP-001', institutionId: 'INST-001' })).toMatchObject({
    completedNeeds: 1,
    items: [
      expect.objectContaining({
        meetingId: 'MTG-004',
        packageId: 'SPKG-001',
        invitationId: 'SINV-001',
        minutesId: 'MMIN-001',
        followupId: 'SFUP-001'
      }),
      expect.anything(),
      expect.anything()
    ]
  });
  expect(
    repository
      .snapshot()
      .auditEntries.filter((item) => item.entityType === 'institution-need' && item.entityId === 'SNEED-001')
  ).toHaveLength(5);
});

it('returns useful conflict alternatives and rejects out-of-scope or unapproved materials without writes', () => {
  const repository = new DemoRepository();
  const service = new InstitutionService(repository);
  expect(service.entitlement({ actorId: 'EMP-001', needId: 'SNEED-002' })).toMatchObject({
    eligible: false,
    reasons: expect.arrayContaining([expect.stringContaining('不在服务范围内')])
  });
  const before = repository.snapshot();
  expect(
    service.validateReserve({ ...reserve, needId: 'SNEED-002', idempotencyKey: 'blocked-scope' })
  ).not.toHaveLength(0);
  expect(
    service
      .validateReserve({
        ...reserve,
        startAt: '2026-09-19T02:00:00.000Z',
        endAt: '2026-09-19T03:00:00.000Z',
        idempotencyKey: 'conflict'
      })
      .flatMap((item) => item.messages)
      .join('')
  ).toContain('可用替代方案');
  expect(repository.snapshot()).toEqual(before);
  expect(
    service.revise({
      actorId: 'EMP-001',
      needId: 'SNEED-003',
      materialIds: ['SMAT-001'],
      reason: '改选已批准资料',
      expectedVersion: 2,
      idempotencyKey: 'return-revise'
    })
  ).toMatchObject({ status: 'new', businessVersion: 3 });
  expect(
    service.revise({
      actorId: 'EMP-001',
      needId: 'SNEED-002',
      materialIds: ['SMAT-001'],
      reason: '改选已批准资料',
      expectedVersion: 1,
      idempotencyKey: 'blocked-revise'
    })
  ).toMatchObject({ status: 'new', businessVersion: 2 });
  expect(service.reserve(reserve)).toMatchObject({ status: 'reserved' });
  expect(
    service
      .validatePackage({
        actorId: 'EMP-003',
        needId: 'SNEED-001',
        materialIds: ['SMAT-002'],
        expectedVersion: 2,
        idempotencyKey: 'bad-package'
      })
      .flatMap((item) => item.messages)
      .join('')
  ).toContain('不在服务范围内');
  repository.transact((state) => {
    const document = state.officeDocuments.find((item) => item.id === 'DOC-002');
    if (!document) throw new Error('Expected seed document DOC-002');
    document.status = 'draft';
  });
  expect(
    service
      .validatePackage({
        actorId: 'EMP-003',
        needId: 'SNEED-001',
        materialIds: ['SMAT-001'],
        expectedVersion: 2,
        idempotencyKey: 'unapproved'
      })
      .flatMap((item) => item.messages)
      .join('')
  ).toContain('尚未批准');
  expect(
    service
      .validateReserve({ ...reserve, expectedVersion: 1, idempotencyKey: 'stale' })
      .flatMap((item) => item.messages)
      .join('')
  ).toContain('版本应为 2');
});
