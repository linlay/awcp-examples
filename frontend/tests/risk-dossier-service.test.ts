import { expect, it } from 'vitest';
import { DemoRepository, type DemoStorage } from '../src/common/store/repository';
import { RiskAlertService, type RiskDraftInput, type RiskInvestigationInput } from '../src/pc/service/riskAlertService';
import { emptyDossier, type RiskInvestigationDraft } from '../src/common/risk/dossier';

function draft(): RiskInvestigationDraft {
  return {
    analysis: '已核对虚构记录与材料，未发现异常。',
    conclusion: 'false-positive',
    proposedDisposition: 'close',
    evidenceIds: ['REVD-001', 'REVD-002'],
    dossier: {
      ...emptyDossier(),
      periodStart: '2026-09-18',
      periodEnd: '2026-09-19',
      riskLevel: 'medium',
      methods: ['system', 'documents'],
      checks: [
        {
          id: 'row-1',
          accountRef: 'DEMO-ACCOUNT-001',
          market: 'SH',
          instrument: 'DEMO-SH-001',
          tradeDate: '2026-09-19',
          direction: 'buy',
          amountCents: 123456,
          finding: 'normal',
          note: ''
        }
      ]
    }
  };
}
function setup(storage?: DemoStorage) {
  const repository = new DemoRepository({ storage });
  const service = new RiskAlertService(repository);
  service.assign({
    actorId: 'EMP-006',
    alertId: 'RALT-001',
    assigneeId: 'EMP-005',
    expectedVersion: 1,
    idempotencyKey: 'dossier-assign'
  });
  return { repository, service };
}
it('persists incomplete drafts, replays idempotently, rejects old versions and resets the draft with the example', () => {
  const values = new Map<string, string>();
  const storage: DemoStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    }
  };
  const { repository, service } = setup(storage);
  const input: RiskDraftInput = {
    actorId: 'EMP-005',
    alertId: 'RALT-001',
    expectedVersion: 2,
    idempotencyKey: 'draft-save',
    draft: { analysis: '', conclusion: '', proposedDisposition: '', evidenceIds: [], dossier: emptyDossier() }
  };
  expect(service.saveDraft(input)).toMatchObject({ businessVersion: 3, status: 'investigating' });
  expect(service.saveDraft(input)).toMatchObject({ businessVersion: 3 });
  const reloaded = new DemoRepository({ storage });
  expect(reloaded.snapshot().riskAlerts.find((a) => a.id === 'RALT-001')?.investigationDraft).toEqual(input.draft);
  const before = repository.snapshot();
  expect(service.validateDraft({ ...input, idempotencyKey: 'stale-draft' })).not.toHaveLength(0);
  expect(
    service.validateDraft({ ...input, actorId: 'EMP-006', expectedVersion: 3, idempotencyKey: 'wrong-role' })
  ).not.toHaveLength(0);
  expect(repository.snapshot()).toEqual(before);
  repository.resetSecuritiesExample('S04', 'RALT-001');
  expect(repository.snapshot().riskAlerts.find((a) => a.id === 'RALT-001')?.investigationDraft).toBeUndefined();
});
it('enforces cross-field and nested-row validation without writing invalid submissions', () => {
  const { repository, service } = setup();
  const d = draft();
  const input: RiskInvestigationInput = {
    actorId: 'EMP-005',
    alertId: 'RALT-001',
    expectedVersion: 2,
    idempotencyKey: 'complex-submit',
    analysis: d.analysis,
    conclusion: 'false-positive',
    proposedDisposition: 'close',
    evidenceIds: d.evidenceIds,
    dossier: d.dossier
  };
  const before = repository.snapshot();
  expect(
    service.validateRecord({
      ...input,
      dossier: { ...d.dossier, checks: [{ ...d.dossier.checks[0], instrument: 'DEMO-SZ-001' }] }
    })
  ).toContainEqual(expect.objectContaining({ path: ['dossier', 'checks', 0, 'instrument'] }));
  expect(service.validateRecord({ ...input, dossier: { ...d.dossier, periodEnd: '2026-02-30' } })).not.toHaveLength(0);
  expect(service.validateRecord({ ...input, dossier: { ...d.dossier, contactRequired: true } })).toContainEqual(
    expect.objectContaining({ path: ['dossier', 'contactMethod'] })
  );
  expect(service.validateRecord({ ...input, conclusion: 'confirmed', proposedDisposition: 'escalate' })).toContainEqual(
    expect.objectContaining({ path: ['dossier', 'measures'] })
  );
  expect(
    service.validateRecord({ ...input, dossier: { ...d.dossier, checks: [d.dossier.checks[0], d.dossier.checks[0]] } })
  ).not.toHaveLength(0);
  expect(repository.snapshot()).toEqual(before);
  expect(service.record(input)).toMatchObject({ status: 'pending-review', businessVersion: 3 });
  d.dossier.checks[0].amountCents = 999;
  const investigation = repository.snapshot().riskInvestigations.find((i) => i.alertId === 'RALT-001');
  expect(investigation?.dossier?.checks[0].amountCents).toBe(123456);
  service.review({
    actorId: 'EMP-004',
    alertId: 'RALT-001',
    decision: 'approve',
    reason: '独立核验通过。',
    expectedVersion: 3,
    idempotencyKey: 'dossier-review'
  });
  expect(
    service.close({
      actorId: 'EMP-006',
      alertId: 'RALT-001',
      resolution: 'close',
      expectedVersion: 4,
      idempotencyKey: 'dossier-close'
    })
  ).toMatchObject({ status: 'closed' });
});
