import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import {
  ResearchService,
  type ResearchMutationInput,
  type ResearchPatchInput,
  type ResearchReviewInput
} from '../src/pc/service/researchService';

function mutation(
  reportId: string,
  expectedVersion: number,
  idempotencyKey: string,
  actorId = 'EMP-003'
): ResearchMutationInput {
  return { reportId, actorId, expectedVersion, idempotencyKey };
}

function review(
  reportId: string,
  expectedVersion: number,
  idempotencyKey: string,
  actorId: string,
  decision: 'approve' | 'return',
  reason = ''
): ResearchReviewInput {
  return { ...mutation(reportId, expectedVersion, idempotencyKey, actorId), decision, reason };
}

it('checks one report version, completes two reviews, publishes once and archives', () => {
  const repository = new DemoRepository();
  const service = new ResearchService(repository);
  const check = mutation('REPORT-001', 1, 's02-check-001');
  expect(service.check(check)).toMatchObject({
    reportId: 'REPORT-001',
    documentVersion: 1,
    policyVersion: 1,
    passed: true
  });
  expect(service.check(check).checkId).toBe('RCHECK-001');
  expect(service.submitReview(mutation('REPORT-001', 1, 's02-submit-001'))).toEqual({
    reportId: 'REPORT-001',
    status: 'quality-review',
    businessVersion: 2,
    documentVersion: 1
  });
  expect(service.submitReview(mutation('REPORT-001', 1, 's02-submit-001')).businessVersion).toBe(2);
  expect(service.review(review('REPORT-001', 2, 's02-quality-approve', 'EMP-005', 'approve'))).toMatchObject({
    status: 'compliance-review',
    businessVersion: 3
  });
  expect(service.review(review('REPORT-001', 3, 's02-compliance-approve', 'EMP-006', 'approve'))).toMatchObject({
    status: 'approved',
    businessVersion: 4
  });
  const publish = { ...mutation('REPORT-001', 4, 's02-publish', 'EMP-007'), scope: 'clients' as const };
  expect(service.publish(publish)).toMatchObject({
    status: 'published',
    businessVersion: 5,
    publicationId: 'PUB-001',
    scope: 'clients'
  });
  expect(service.publish(publish).publicationId).toBe('PUB-001');
  expect(repository.snapshot().researchPublications).toHaveLength(1);
  expect(service.archive(mutation('REPORT-001', 5, 's02-archive', 'EMP-007'))).toMatchObject({
    status: 'archived',
    businessVersion: 6
  });
  expect(service.submitReview(mutation('REPORT-001', 1, 's02-submit-001'))).toMatchObject({
    status: 'quality-review',
    businessVersion: 2,
    documentVersion: 1
  });
  expect(service.publish(publish)).toMatchObject({ status: 'published', businessVersion: 5, publicationId: 'PUB-001' });
  expect(repository.snapshot().researchPublications).toHaveLength(1);
  expect(service.read({ reportId: 'REPORT-001', actorId: 'EMP-003' })).toMatchObject({
    status: 'archived',
    checked: true,
    reviews: [
      { stage: 'quality', decision: 'approve' },
      { stage: 'compliance', decision: 'approve' }
    ],
    publications: [{ id: 'PUB-001', documentVersion: 1, scope: 'clients' }]
  });
  expect(
    repository
      .snapshot()
      .todos.filter((item) => item.sourceId === 'REPORT-001')
      .map((item) => item.status)
  ).toEqual(['done', 'done']);
});

it('blocks missing references, disclosures, reviews and wrong roles without partial writes', () => {
  const repository = new DemoRepository();
  const service = new ResearchService(repository);
  const initial = repository.snapshot();
  expect(service.validateCheck(mutation('REPORT-002', 1, 's02-blocked-check')).map((item) => item.path)).toEqual(
    expect.arrayContaining([['citations'], ['disclosures']])
  );
  expect(() => service.check(mutation('REPORT-002', 1, 's02-blocked-check'))).toThrow('引用');
  expect(() => service.submitReview(mutation('REPORT-002', 1, 's02-blocked-submit'))).toThrow('先按当前文档');
  expect(() =>
    service.publish({ ...mutation('REPORT-002', 1, 's02-blocked-publish', 'EMP-007'), scope: 'internal' })
  ).toThrow('两级审阅');
  expect(repository.snapshot()).toEqual(initial);
  service.check(mutation('REPORT-001', 1, 's02-check-role'));
  service.submitReview(mutation('REPORT-001', 1, 's02-submit-role'));
  const submitted = repository.snapshot();
  expect(() => service.review(review('REPORT-001', 2, 's02-wrong-role', 'EMP-006', 'approve'))).toThrow('角色不匹配');
  expect(() => service.review(review('REPORT-001', 2, 's02-empty-reason', 'EMP-005', 'return'))).toThrow('退回需填写');
  expect(repository.snapshot()).toEqual(submitted);
});

it('returns a report, creates a new document version and requires fresh checks and approvals', () => {
  const repository = new DemoRepository();
  const service = new ResearchService(repository);
  service.check(mutation('REPORT-003', 1, 's02-return-check'));
  service.submitReview(mutation('REPORT-003', 1, 's02-return-submit'));
  expect(service.review(review('REPORT-003', 2, 's02-return', 'EMP-005', 'return', '请补充分析依据'))).toMatchObject({
    status: 'returned',
    businessVersion: 3
  });
  const patch: ResearchPatchInput = {
    ...mutation('REPORT-003', 3, 's02-return-patch'),
    title: '虚构主题修订报告第二版',
    content: '根据退回意见补充演示分析依据。',
    citations: ['DEMO-SOURCE-003', 'DEMO-SOURCE-004'],
    disclosures: ['仅供虚构演示。']
  };
  expect(service.patch(patch)).toEqual({
    reportId: 'REPORT-003',
    status: 'draft',
    businessVersion: 4,
    documentVersion: 2
  });
  expect(service.patch(patch).documentVersion).toBe(2);
  const corrected = repository.snapshot();
  expect(() => service.submitReview(mutation('REPORT-003', 4, 's02-resubmit-early'))).toThrow('先按当前文档');
  expect(repository.snapshot()).toEqual(corrected);
  expect(service.check(mutation('REPORT-003', 4, 's02-return-check-v2')).documentVersion).toBe(2);
  service.submitReview(mutation('REPORT-003', 4, 's02-return-submit-v2'));
  service.review(review('REPORT-003', 5, 's02-quality-v2', 'EMP-005', 'approve'));
  service.review(review('REPORT-003', 6, 's02-compliance-v2', 'EMP-006', 'approve'));
  expect(
    service.publish({ ...mutation('REPORT-003', 7, 's02-publish-v2', 'EMP-007'), scope: 'internal' })
  ).toMatchObject({ documentVersion: 2, status: 'published' });
  expect(repository.snapshot().researchReviews.map((item) => [item.documentVersion, item.decision])).toEqual([
    [1, 'return'],
    [2, 'approve'],
    [2, 'approve']
  ]);
  expect(service.read({ reportId: 'REPORT-003', actorId: 'EMP-003' }).history).toEqual(
    expect.arrayContaining([expect.objectContaining({ action: 'quality-return', note: '请补充分析依据' })])
  );
});

it('creates a topic and requires a fresh check when demonstration rules change', () => {
  const repository = new DemoRepository();
  const service = new ResearchService(repository);
  const created = service.create({ actorId: 'EMP-003', topicTitle: '新建虚构课题', idempotencyKey: 's02-create' });
  expect(created).toMatchObject({ reportId: 'REPORT-004', status: 'draft', documentVersion: 1 });
  expect(service.create({ actorId: 'EMP-003', topicTitle: '新建虚构课题', idempotencyKey: 's02-create' })).toEqual(
    created
  );
  expect(repository.snapshot().researchTopics).toHaveLength(4);
  service.patch({
    ...mutation('REPORT-004', 1, 's02-new-patch'),
    title: '新建虚构报告',
    content: '演示报告正文。',
    citations: ['DEMO-SOURCE-NEW'],
    disclosures: ['仅供虚构演示。']
  });
  service.check(mutation('REPORT-004', 2, 's02-new-check-v1'));
  repository.transact((state) => {
    state.researchPolicy.version = 2;
  });
  expect(() => service.submitReview(mutation('REPORT-004', 2, 's02-new-submit-early'))).toThrow('先按当前文档');
  expect(service.check(mutation('REPORT-004', 2, 's02-new-check-v2')).policyVersion).toBe(2);
  expect(service.submitReview(mutation('REPORT-004', 2, 's02-new-submit-v2')).status).toBe('quality-review');
});
