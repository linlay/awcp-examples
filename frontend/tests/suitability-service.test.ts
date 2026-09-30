import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { SuitabilityService, type ClientMutationInput } from '../src/pc/service/suitabilityService';

function input(clientId: string, expectedVersion: number, key: string, actorId = 'EMP-001'): ClientMutationInput {
  return { clientId, actorId, expectedVersion, idempotencyKey: key };
}

it('evaluates, matches, reviews and archives a complete demo client with stable retries', () => {
  const repository = new DemoRepository();
  const service = new SuitabilityService(repository);
  const evaluate = input('CLI-001', 1, 's01-evaluate');
  expect(service.evaluate(evaluate)).toMatchObject({ riskLevel: 3, policyVersion: 1, businessVersion: 1 });
  expect(service.evaluate(evaluate).assessmentId).toBe('ASSESS-001');
  const mismatch = service.match({ ...input('CLI-001', 1, 's01-risky'), productId: 'PRD-002' });
  expect(mismatch).toMatchObject({ eligible: false, productId: 'PRD-002' });
  const blocked = repository.snapshot();
  expect(() => service.submit(input('CLI-001', 1, 's01-too-early'))).toThrow('没有符合演示规则');
  expect(repository.snapshot()).toEqual(blocked);
  expect(service.match({ ...input('CLI-001', 1, 's01-match'), productId: 'PRD-001' }).eligible).toBe(true);
  const submit = input('CLI-001', 1, 's01-submit');
  expect(service.submit(submit)).toEqual({ clientId: 'CLI-001', status: 'submitted', businessVersion: 2 });
  expect(service.submit(submit).businessVersion).toBe(2);
  expect(repository.snapshot().clientReviews).toHaveLength(1);
  expect(
    repository.snapshot().todos.filter((todo) => todo.sourceId === 'CLI-001' && todo.status === 'open')
  ).toHaveLength(1);
  expect(
    service.decide({
      ...input('CLI-001', 2, 's01-approve', 'EMP-004'),
      decision: 'approve',
      reason: ''
    })
  ).toEqual({ clientId: 'CLI-001', status: 'approved', businessVersion: 3 });
  expect(service.archive(input('CLI-001', 3, 's01-archive', 'EMP-004'))).toEqual({
    clientId: 'CLI-001',
    status: 'archived',
    businessVersion: 4
  });
  expect(service.read({ clientId: 'CLI-001', actorId: 'EMP-001' })).toMatchObject({
    status: 'archived',
    latestAssessment: { riskLevel: 3 },
    reviews: [{ status: 'approved' }]
  });
  expect(
    repository
      .snapshot()
      .auditEntries.filter((entry) => entry.entityId === 'CLI-001')
      .map((entry) => entry.action)
  ).toEqual(['evaluate', 'match', 'match', 'review-submit', 'approve', 'archive']);
});

it('blocks missing and expired inputs, then returns and recovers using a new business version', () => {
  const repository = new DemoRepository();
  const service = new SuitabilityService(repository);
  const before = repository.snapshot();
  expect(service.validateEvaluate(input('CLI-002', 1, 's01-missing')).map((item) => item.path)).toEqual(
    expect.arrayContaining([['identityDocumentNo'], ['contactPhone'], ['questionnaire']])
  );
  expect(service.validateEvaluate(input('CLI-003', 1, 's01-expired')).map((item) => item.path)).toContainEqual([
    'questionnaire',
    'answeredAt'
  ]);
  expect(() => service.evaluate(input('CLI-003', 1, 's01-expired'))).toThrow('问卷已过期');
  expect(repository.snapshot()).toEqual(before);
  service.evaluate(input('CLI-001', 1, 's01-eval-return'));
  service.match({ ...input('CLI-001', 1, 's01-match-return'), productId: 'PRD-001' });
  service.submit(input('CLI-001', 1, 's01-submit-return'));
  const submitted = repository.snapshot();
  expect(() =>
    service.decide({ ...input('CLI-001', 2, 's01-no-reason', 'EMP-004'), decision: 'return', reason: '' })
  ).toThrow('退回需填写');
  expect(repository.snapshot()).toEqual(submitted);
  expect(
    service.decide({
      ...input('CLI-001', 2, 's01-return', 'EMP-004'),
      decision: 'return',
      reason: '请更新联系资料'
    })
  ).toMatchObject({ status: 'returned', businessVersion: 3 });
  expect(() => service.submit(input('CLI-001', 3, 's01-resubmit-early'))).toThrow('当前状态不可');
  expect(
    service.patch({
      ...input('CLI-001', 3, 's01-patch'),
      identityDocumentNo: 'DEMO-IDENTITY-001',
      contactPhone: '13800000009',
      questionnaire: { riskTolerance: 3, lossCapacity: 3, answeredAt: repository.clock.now() }
    })
  ).toMatchObject({ status: 'draft', businessVersion: 4 });
  expect(() => service.submit(input('CLI-001', 4, 's01-resubmit-unassessed'))).toThrow('风险评估');
  service.evaluate(input('CLI-001', 4, 's01-eval-again'));
  service.match({ ...input('CLI-001', 4, 's01-match-again'), productId: 'PRD-001' });
  expect(service.submit(input('CLI-001', 4, 's01-submit-again'))).toMatchObject({
    status: 'submitted',
    businessVersion: 5
  });
  expect(repository.snapshot().clientReviews.map((item) => item.status)).toEqual(['returned', 'pending']);
  expect(service.read({ clientId: 'CLI-001', actorId: 'EMP-004' }).history).toEqual(
    expect.arrayContaining([expect.objectContaining({ action: 'return', note: '请更新联系资料' })])
  );
});

it('requires a new assessment and match when the demo rule version changes', () => {
  const repository = new DemoRepository();
  const service = new SuitabilityService(repository);
  service.evaluate(input('CLI-001', 1, 's01-policy-eval-v1'));
  service.match({ ...input('CLI-001', 1, 's01-policy-match-v1'), productId: 'PRD-001' });
  repository.transact((draft) => {
    draft.suitabilityPolicy.version = 2;
  });
  expect(() => service.submit(input('CLI-001', 1, 's01-policy-submit-early'))).toThrow('当前版本完成风险评估');
  expect(service.evaluate(input('CLI-001', 1, 's01-policy-eval-v2')).policyVersion).toBe(2);
  expect(() => service.submit(input('CLI-001', 1, 's01-policy-submit-unmatched'))).toThrow('没有符合演示规则');
  service.match({ ...input('CLI-001', 1, 's01-policy-match-v2'), productId: 'PRD-001' });
  expect(service.submit(input('CLI-001', 1, 's01-policy-submit-v2')).status).toBe('submitted');
});
