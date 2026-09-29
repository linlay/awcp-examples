import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { ReportArchiveService } from '../src/pc/service/reportArchiveService';

it('keeps accepted and completed phases distinct and drills anomalies from the same frozen rows', () => {
  const repository = new DemoRepository();
  const queued: Array<() => void> = [];
  const service = new ReportArchiveService(repository, (work) => queued.push(work));
  const input = {
    actorId: 'EMP-004',
    departmentId: 'DEP-001',
    startDate: '2026-09-14',
    endDate: '2026-09-20',
    idempotencyKey: 'report-1'
  };
  const before = repository.snapshot();
  expect(service.validateGenerate({ ...input, endDate: '2026-09-01' })).not.toHaveLength(0);
  expect(service.validateGenerate({ ...input, actorId: 'EMP-003' })).not.toHaveLength(0);
  expect(repository.snapshot()).toEqual(before);
  expect(service.generate(input)).toEqual({ status: 'accepted', jobId: 'RJOB-002' });
  expect(service.read({ actorId: 'EMP-004', jobId: 'RJOB-002' })).toMatchObject({
    status: 'accepted',
    unit: '件',
    totalCount: null
  });
  expect(service.validateDetails({ actorId: 'EMP-004', jobId: 'RJOB-002', page: 1, pageSize: 2 })).not.toHaveLength(0);
  expect(service.generate(input)).toEqual({ status: 'accepted', jobId: 'RJOB-002' });
  expect(queued).toHaveLength(1);
  queued[0]();
  expect(service.read({ actorId: 'EMP-004', jobId: 'RJOB-002' })).toMatchObject({
    status: 'completed',
    totalCount: 6,
    anomalyCount: 3,
    unit: '件'
  });
  const first = service.details({ actorId: 'EMP-004', jobId: 'RJOB-002', page: 1, pageSize: 2 });
  const second = service.details({ actorId: 'EMP-004', jobId: 'RJOB-002', page: 2, pageSize: 2 });
  expect(first).toMatchObject({
    totalCount: 3,
    page: 1,
    rows: expect.arrayContaining([expect.objectContaining({ sourceId: 'PREQ-001', sourceType: 'purchase-request' })])
  });
  expect(second).toMatchObject({
    totalCount: 3,
    page: 2,
    rows: [expect.objectContaining({ sourceId: 'TKT-002', sourceType: 'it-ticket' })]
  });
  expect(service.validateDetails({ actorId: 'EMP-004', jobId: 'RJOB-002', page: 0, pageSize: 2 })).not.toHaveLength(0);
  repository.transact((state) => {
    state.itTickets[0].status = 'closed';
  });
  expect(service.details({ actorId: 'EMP-004', jobId: 'RJOB-002', page: 1, pageSize: 20 }).totalCount).toBe(3);
});

it('saves immutable archive versions and denies stale writes or unauthorized history reads', () => {
  const repository = new DemoRepository();
  const service = new ReportArchiveService(repository, () => {});
  const create = {
    actorId: 'EMP-004',
    reportId: 'RJOB-001',
    archiveId: null,
    expectedVersion: null,
    idempotencyKey: 'archive-1'
  };
  expect(service.save(create)).toMatchObject({ id: 'ARC-002', status: 'saved', businessVersion: 1 });
  expect(service.save(create)).toMatchObject({ id: 'ARC-002', businessVersion: 1 });
  const first = service.search({ actorId: 'EMP-004', archiveId: 'ARC-002', version: 1 });
  expect(first).toMatchObject({
    version: { reportId: 'RJOB-001', totalCount: 1, anomalyCount: 1 },
    operations: [expect.objectContaining({ version: 1 })]
  });
  expect(service.validateSearch({ actorId: 'EMP-001', archiveId: 'ARC-002', version: 1 })).not.toHaveLength(0);
  expect(service.validateSearch({ actorId: 'EMP-004', archiveId: 'ARC-002', version: 2 })).not.toHaveLength(0);
  expect(
    service.validateSave({ ...create, archiveId: 'ARC-002', expectedVersion: 9, idempotencyKey: 'stale' })
  ).not.toHaveLength(0);
  expect(
    service.save({ ...create, archiveId: 'ARC-002', expectedVersion: 1, idempotencyKey: 'archive-2' })
  ).toMatchObject({ businessVersion: 2 });
  expect(service.search({ actorId: 'EMP-004', archiveId: 'ARC-002', version: 1 })).toMatchObject({
    version: { version: 1 },
    operations: [expect.anything(), expect.anything()]
  });
  expect(service.search({ actorId: 'EMP-004', archiveId: 'ARC-002', version: 2 })).toMatchObject({
    version: { version: 2, reportId: 'RJOB-001' }
  });
  expect(repository.snapshot().officeArchives.find((item) => item.id === 'ARC-002')?.versions).toHaveLength(2);
});
