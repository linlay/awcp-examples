import {
  FilterOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SolutionOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAwcpAction } from '@app/awcp';
import type { AwcpActionRegistration } from '@app/awcp';
import { useEffect, useState, type ReactElement } from 'react';

import { completed, describeAction } from '../../common/awcp/contracts';
import {
  RISK_ASSIGN_SCHEMA,
  RISK_CLOSE_SCHEMA,
  RISK_EVIDENCE_SCHEMA,
  RISK_INVESTIGATION_SCHEMA,
  RISK_QUERY_SCHEMA,
  RISK_READ_SCHEMA,
  RISK_REVIEW_SCHEMA
} from '../../common/awcp/riskSchemas';
import type { DemoRepository } from '../../common/store/repository';
import {
  RiskAlertService,
  type RiskAssignInput,
  type RiskCloseInput,
  type RiskEvidenceInput,
  type RiskInvestigationInput,
  type RiskQueryInput,
  type RiskReadInput,
  type RiskReviewInput
} from '../service/riskAlertService';
import styles from './S04RiskPage.module.css';

const QUERY: RiskQueryInput = { actorId: 'EMP-006', status: 'all', ruleId: null, page: 1, pageSize: 10 };
const READ: RiskReadInput = { actorId: 'EMP-006', alertId: 'RALT-001' };
const ASSIGN: RiskAssignInput = {
  actorId: 'EMP-006',
  alertId: 'RALT-001',
  assigneeId: 'EMP-005',
  expectedVersion: 1,
  idempotencyKey: 's04-assign-example'
};
const ATTACH: RiskEvidenceInput = {
  actorId: 'EMP-006',
  alertId: 'RALT-002',
  evidenceId: 'REVD-004',
  expectedVersion: 1,
  idempotencyKey: 's04-attach-example'
};
const RECORD: RiskInvestigationInput = {
  actorId: 'EMP-005',
  alertId: 'RALT-003',
  evidenceIds: ['REVD-005', 'REVD-006'],
  analysis: '已补充核对虚构活动和身份来源，确认属于演示误报。',
  conclusion: 'false-positive',
  proposedDisposition: 'close',
  expectedVersion: 4,
  idempotencyKey: 's04-record-example'
};
const REVIEW: RiskReviewInput = {
  actorId: 'EMP-004',
  alertId: 'RALT-005',
  decision: 'approve',
  reason: '证据和分析齐全。',
  expectedVersion: 3,
  idempotencyKey: 's04-review-example'
};
const CLOSE: RiskCloseInput = {
  actorId: 'EMP-006',
  alertId: 'RALT-004',
  resolution: 'escalate',
  expectedVersion: 4,
  idempotencyKey: 's04-close-example'
};

function guide(purpose: string, prerequisites: string, effects: string): string {
  return describeAction({
    purpose,
    prerequisites,
    parameters: '提供虚构预警、人员、证据 ID；写入须提供当前 businessVersion 与稳定业务幂等键。',
    effects,
    result: '返回预警 ID、状态和新业务版本；只读返回带版本规则、证据、调查、复核与审计历史。',
    failures: '角色、证据、状态、规则版本或业务版本不符时返回字段错误，不写入。'
  });
}

function key(): string {
  return `s04-ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function S04RiskPage({
  repository,
  objectId
}: {
  repository: DemoRepository;
  objectId?: string;
}): ReactElement {
  const [service] = useState(() => new RiskAlertService(repository));
  const [, setRevision] = useState(0);

  useEffect(() => service.subscribe(() => setRevision((value) => value + 1)), [service]);

  const [actorId, setActorId] = useState('EMP-006');
  const alertId = objectId ?? 'RALT-001';
  const [status, setStatus] = useState<RiskQueryInput['status']>('all');
  const [assigneeId, setAssigneeId] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [evidenceIds, setEvidenceIds] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [conclusion, setConclusion] = useState<'' | RiskInvestigationInput['conclusion']>('');
  const [proposedDisposition, setProposedDisposition] =
    useState<'' | RiskInvestigationInput['proposedDisposition']>('');
  const [decision, setDecision] = useState<'' | RiskReviewInput['decision']>('');
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState<'' | RiskCloseInput['resolution']>('');
  const [message, setMessage] = useState('');
  const [queryResult, setQueryResult] = useState<{ totalCount: number; alerts: Array<{ id: string; title: string }> } | null>(null);

  const state = service.snapshot();
  const alert = state.riskAlerts.find((item) => item.id === alertId);
  const rule = state.riskRules.find((item) => item.id === alert?.ruleId && item.version === alert.ruleVersion);
  const linked = state.riskEvidence.filter((item) => item.alertId === alertId);
  const available = state.riskEvidence.filter(
    (item) => item.alertId === null && item.sourceType === alert?.sourceType && item.sourceId === alert.sourceId
  );
  const investigation = state.riskInvestigations.find((item) => item.id === alert?.latestInvestigationId);
  const history = state.auditEntries.filter((item) => item.entityType === 'risk-alert' && item.entityId === alertId);

  function run(task: () => { alertId: string; status: string; businessVersion: number }): void {
    try {
      const result = task();
      setMessage(`${result.alertId}：${result.status}，版本 ${result.businessVersion}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败。');
    }
  }

  const queryAction: AwcpActionRegistration<RiskQueryInput> = {
    action: 'securities.alert.query',
    title: '筛选风险预警',
    description: guide('按状态与演示规则筛选预警。', '在职风险流程人员；合法分页。', '只读，不改变预警状态。'),
    inputSchema: RISK_QUERY_SCHEMA,
    examples: [QUERY],
    validate: (args) => service.validateQuery(args),
    invoke: (args) => completed(service.query(args))
  };
  useAwcpAction(queryAction);

  const readAction: AwcpActionRegistration<RiskReadInput> = {
    action: 'securities.alert.read',
    title: '读取规则、证据与历史',
    description: guide(
      '读取单张预警的指标、规则版本、证据、调查、复核和审计。',
      '在职风险流程人员，预警存在。',
      '只读。'
    ),
    inputSchema: RISK_READ_SCHEMA,
    examples: [READ],
    validate: (args) => service.validateRead(args),
    invoke: (args) => completed(service.read(args))
  };
  useAwcpAction(readAction);

  const assignAction: AwcpActionRegistration<RiskAssignInput> = {
    action: 'securities.alert.assign',
    title: '分派预警调查',
    description: guide(
      '将新预警分派给在职调查员。',
      '风险监控员、new 状态及当前版本。',
      '记录调查人和分派审计，状态改为 investigating。'
    ),
    inputSchema: RISK_ASSIGN_SCHEMA,
    examples: [ASSIGN],
    validate: (args) => service.validateAssign(args),
    invoke: (args) => completed(service.assign(args))
  };
  useAwcpAction(assignAction);

  const attachAction: AwcpActionRegistration<RiskEvidenceInput> = {
    action: 'securities.alert.evidence.attach',
    title: '补充核验证据',
    description: guide(
      '为预警关联同来源的已核验证据。',
      '监控员或指定调查员；证据尚未关联其他预警。',
      '保留证据 ID 和版本审计，不覆盖历史调查。'
    ),
    inputSchema: RISK_EVIDENCE_SCHEMA,
    examples: [ATTACH],
    validate: (args) => service.validateAttach(args),
    invoke: (args) => completed(service.attach(args))
  };
  useAwcpAction(attachAction);

  const recordAction: AwcpActionRegistration<RiskInvestigationInput> = {
    action: 'securities.investigation.record',
    title: '登记调查结论与处置建议',
    description: guide(
      '在分派或退回状态登记分析、结论、处置建议和证据快照。',
      '指定调查员、至少一份已关联核验证据及当前版本。',
      '生成新调查记录并转为 pending-review；旧调查和退回记录保留。'
    ),
    inputSchema: RISK_INVESTIGATION_SCHEMA,
    examples: [RECORD],
    validate: (args) => service.validateRecord(args),
    invoke: (args) => completed(service.record(args))
  };
  useAwcpAction(recordAction);

  const reviewAction: AwcpActionRegistration<RiskReviewInput> = {
    action: 'securities.alert.review',
    title: '独立复核或退回',
    description: guide(
      '复核当前调查，批准或说明原因退回。',
      '独立复核员、pending-review；批准须满足该版本规则所需证据。',
      '写入复核历史，转 approved 或 returned。'
    ),
    inputSchema: RISK_REVIEW_SCHEMA,
    examples: [REVIEW],
    validate: (args) => service.validateReview(args),
    invoke: (args) => completed(service.review(args))
  };
  useAwcpAction(reviewAction);

  const closeAction: AwcpActionRegistration<RiskCloseInput> = {
    action: 'securities.alert.close',
    title: '关闭或升级预警',
    description: guide(
      '执行已获批的关闭或升级建议。',
      '风险监控员、当前调查已独立复核批准且证据齐全。',
      '保存最终 closed 或 escalated 状态、完成时间和审计。'
    ),
    inputSchema: RISK_CLOSE_SCHEMA,
    examples: [CLOSE],
    validate: (args) => service.validateClose(args),
    invoke: (args) => completed(service.close(args))
  };
  useAwcpAction(closeAction);


  return (
    <main className={styles.page}>
      <label className={styles.formLabel}>
        <UserOutlined /> 操作人{' '}
        <select aria-label="操作人" className={styles.select} value={actorId} onChange={(event) => setActorId(event.target.value)}>
          {state.employees
            .filter((item) => item.active && item.roles.some((role) => ['risk-monitor', 'risk-investigator', 'risk-reviewer'].includes(role)))
            .map((item) => <option key={item.id} value={item.id}>{item.id} {item.name}</option>)}
        </select>
      </label>

      {/* Workstation 4-Stage Grid */}
      <div className={styles.sectionsGrid}>
        {/* Stage 1: Filter & Alert Details */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <FilterOutlined /> 预警筛选与指标详情
            </h2>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                筛选状态{' '}
                <select
                  aria-label="筛选状态"
                  className={styles.select}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RiskQueryInput['status'])}
                >
                  {(
                    ['all', 'new', 'investigating', 'pending-review', 'returned', 'approved', 'closed', 'escalated'] as const
                  ).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

          </div>

          <button
            type="button"
            className={styles.btnAction}
            onClick={() => {
              try {
                const value = service.query({ actorId, status, ruleId: null, page: 1, pageSize: 20 });
                setQueryResult(value as { totalCount: number; alerts: Array<{ id: string; title: string }> });
                setMessage('预警筛选完成。');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : '筛选失败。');
              }
            }}
          >
            筛选预警
          </button>

          {queryResult && <p>筛选命中 {queryResult.totalCount} 条预警。{queryResult.alerts.map((item) => <a key={item.id} href={`/scenes/S04/objects/${encodeURIComponent(item.id)}`}>{item.title}（{item.id}）</a>)}</p>}

          <div className={styles.detailBox}>
            <p style={{ margin: '0 0 6px' }}>
              来源 {alert?.sourceType} / {alert?.sourceId ? <a href={`/scenes/${alert.sourceType === 'client' ? 'S01' : 'S03'}/objects/${encodeURIComponent(alert.sourceId)}`}>{alert.sourceId}</a> : '无'}；指标 {alert?.observedValue} {rule?.unit}；规则 {rule?.id} v
              {rule?.version}，演示阈值 {rule?.threshold}；状态 {alert?.status}；业务版本 {alert?.businessVersion}。
            </p>
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
              规则要求证据：{rule?.requiredEvidenceKinds.join('、')}。关联证据：
              {linked.map((item) => `${item.id} ${item.kind}${item.verified ? ' 已核验' : ' 未核验'}`).join('；') || '无'}。
            </p>
          </div>
        </section>

        {/* Stage 2: Assignment & Evidence */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <SendOutlined /> 调查分派与证据补充
            </h2>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                指派调查人{' '}
                <select
                  aria-label="调查人"
                  className={styles.select}
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">请选择</option>
                  {state.employees
                    .filter((item) => item.active && item.roles.includes('risk-investigator'))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id} {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className={styles.btnAction}
                disabled={!assigneeId}
                onClick={() =>
                  run(() =>
                    service.assign({
                      actorId,
                      alertId,
                      assigneeId,
                      expectedVersion: alert?.businessVersion ?? 0,
                      idempotencyKey: key()
                    })
                  )
                }
              >
                分派调查
              </button>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                可补充证据库{' '}
                <select
                  aria-label="可补充证据"
                  className={styles.select}
                  value={evidenceId}
                  onChange={(e) => setEvidenceId(e.target.value)}
                >
                  <option value="">请选择</option>
                  {available.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} {item.kind}（{item.verified ? '已核验' : '未核验'}）
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={styles.btnAction}
                disabled={!evidenceId}
                onClick={() =>
                  run(() =>
                    service.attach({
                      actorId,
                      alertId,
                      evidenceId,
                      expectedVersion: alert?.businessVersion ?? 0,
                      idempotencyKey: key()
                    })
                  )
                }
              >
                补充证据
              </button>
            </div>
          </div>
        </section>

        {/* Stage 3: Investigation Conclusion */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <SolutionOutlined /> 调查结论与处置意见
            </h2>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>
                证据 ID（逗号分隔）{' '}
                <input
                  aria-label="调查证据 ID"
                  className={styles.input}
                  value={evidenceIds}
                  placeholder={linked.map((item) => item.id).join(',')}
                  onChange={(e) => setEvidenceIds(e.target.value)}
                />
              </label>
            </div>

            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>
                调查分析说明{' '}
                <input
                  aria-label="调查分析"
                  className={styles.input}
                  value={analysis}
                  onChange={(e) => setAnalysis(e.target.value)}
                />
              </label>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                定性结论{' '}
                <select
                  aria-label="调查结论"
                  className={styles.select}
                  value={conclusion}
                  onChange={(e) => setConclusion(e.target.value as RiskInvestigationInput['conclusion'])}
                >
                  <option value="">请选择</option>
                  <option value="false-positive">演示误报</option>
                  <option value="confirmed">确认预警</option>
                </select>
              </label>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                建议处置措施{' '}
                <select
                  aria-label="处置建议"
                  className={styles.select}
                  value={proposedDisposition}
                  onChange={(e) =>
                    setProposedDisposition(e.target.value as RiskInvestigationInput['proposedDisposition'])
                  }
                >
                  <option value="">请选择</option>
                  <option value="close">关闭</option>
                  <option value="escalate">升级</option>
                </select>
              </label>
            </div>
          </div>

          <button
            type="button"
            className={styles.btnAction}
            disabled={!analysis.trim() || !conclusion || !proposedDisposition || !(evidenceIds.trim() || linked.length)}
            onClick={() =>
              run(() =>
                service.record({
                  actorId,
                  alertId,
                  evidenceIds: (evidenceIds.trim() || linked.map((item) => item.id).join(','))
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                  analysis,
                  conclusion: conclusion as RiskInvestigationInput['conclusion'],
                  proposedDisposition: proposedDisposition as RiskInvestigationInput['proposedDisposition'],
                  expectedVersion: alert?.businessVersion ?? 0,
                  idempotencyKey: key()
                })
              )
            }
          >
            登记调查
          </button>

          <div className={styles.detailBox}>
            当前调查：{investigation?.id ?? '无'}；{investigation?.analysis ?? ''}；证据{' '}
            {investigation?.evidenceIds.join('、') ?? ''}。
          </div>
        </section>

        {/* Stage 4: Review & Final Closeout */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <SafetyCertificateOutlined /> 独立复核与终态闭环
            </h2>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                复核决定{' '}
                <select
                  aria-label="复核决定"
                  className={styles.select}
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as RiskReviewInput['decision'])}
                >
                  <option value="">请选择</option>
                  <option value="approve">批准</option>
                  <option value="return">退回</option>
                </select>
              </label>
              <label className={styles.formLabel} style={{ marginTop: 6 }}>
                复核意见{' '}
                <input
                  aria-label="复核意见"
                  className={styles.input}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={`${styles.btnAction} ${styles.btnActionSuccess}`}
                style={{ marginTop: 8 }}
                disabled={!decision || (decision === 'return' && !reason.trim())}
                onClick={() =>
                  run(() =>
                    service.review({
                      actorId,
                      alertId,
                      decision: decision as RiskReviewInput['decision'],
                      reason,
                      expectedVersion: alert?.businessVersion ?? 0,
                      idempotencyKey: key()
                    })
                  )
                }
              >
                复核调查
              </button>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                最终处置决策{' '}
                <select
                  aria-label="最终处置"
                  className={styles.select}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as RiskCloseInput['resolution'])}
                >
                  <option value="">请选择</option>
                  <option value="close">关闭</option>
                  <option value="escalate">升级</option>
                </select>
              </label>
              <button
                type="button"
                className={`${styles.btnAction} ${styles.btnActionDanger}`}
                style={{ marginTop: 42 }}
                disabled={!resolution}
                onClick={() =>
                  run(() =>
                    service.close({
                      actorId,
                      alertId,
                      resolution: resolution as RiskCloseInput['resolution'],
                      expectedVersion: alert?.businessVersion ?? 0,
                      idempotencyKey: key()
                    })
                  )
                }
              >
                执行处置
              </button>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '10px 0 6px' }}>复核记录</h3>
            <ol className={styles.historyList}>
              {state.riskReviews
                .filter((item) => item.alertId === alertId)
                .map((item) => (
                  <li key={item.id} className={styles.historyItem}>
                    {item.id} {item.decision}；{item.reason}；关联 {item.investigationId}
                  </li>
                ))}
            </ol>
          </div>

          <div>
            <h3 style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '10px 0 6px' }}>审计历史</h3>
            <ol className={styles.historyList}>
              {history.map((item) => (
                <li key={item.id} className={styles.historyItem}>
                  {item.action}：{item.fromStatus} → {item.toStatus}；版本 {item.businessVersion}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      {message && (
        <p role="status" className={styles.statusMessage}>
          {message}
        </p>
      )}
    </main>
  );
}
