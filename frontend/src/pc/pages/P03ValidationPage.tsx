import { useAwcpAction } from '@app/awcp';
import type { AwcpActionRegistration, AwcpFieldError, JsonObject } from '@app/awcp';
import type { ReactElement } from 'react';

import { completed, describeAction, describePage, fieldError } from '../../common/awcp/contracts';
import type { DemoRepository } from '../../common/store/repository';
import styles from './P01DiscoveryPage.module.css';

interface ProbeInput extends JsonObject {
  actorId: string;
  resourceId: string;
  startAt: string;
  endAt: string;
  amountCents: number;
}

const RULE = { version: 1, maxAmountCents: 200_000 } as const;
const EXAMPLE: ProbeInput = {
  actorId: 'EMP-001',
  resourceId: 'ROOM-001',
  startAt: '2026-09-20T04:00:00.000Z',
  endAt: '2026-09-20T05:00:00.000Z',
  amountCents: 10_000
};
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'resourceId', 'startAt', 'endAt', 'amountCents'],
  properties: {
    actorId: { type: 'string', pattern: '^EMP-[0-9]{3}$' },
    resourceId: { type: 'string', pattern: '^ROOM-[0-9]{3}$' },
    startAt: { type: 'string', minLength: 20 },
    endAt: { type: 'string', minLength: 20 },
    amountCents: { type: 'integer', minimum: 1 }
  }
};

function validate(repository: DemoRepository, input: ProbeInput): AwcpFieldError[] {
  const state = repository.snapshot();
  const errors: AwcpFieldError[] = [];
  if (!state.employees.some((item) => item.id === input.actorId && item.active))
    errors.push(fieldError(['actorId'], '人员 ID 不存在或已离职。'));
  if (!state.meetingResources.some((item) => item.id === input.resourceId))
    errors.push(fieldError(['resourceId'], '会议室 ID 不存在。'));
  const start = Date.parse(input.startAt);
  const end = Date.parse(input.endAt);
  if (!Number.isFinite(start) || start < Date.parse(repository.clock.now()))
    errors.push(fieldError(['startAt'], '开始时间须为有效的当前或未来时刻。'));
  if (!Number.isFinite(end) || !Number.isFinite(start) || end <= start)
    errors.push(fieldError(['endAt'], '结束时间须晚于开始时间。'));
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    const conflict = state.meetings.find(
      (item) => item.resourceId === input.resourceId && start < Date.parse(item.endAt) && end > Date.parse(item.startAt)
    );
    if (conflict) errors.push(fieldError(['startAt'], `会议室与 ${conflict.id} 的时段冲突。`));
  }
  if (input.amountCents > RULE.maxAmountCents)
    errors.push(fieldError(['amountCents'], `超过版本 ${RULE.version} 的演示额度 ${RULE.maxAmountCents} 分。`));
  return errors;
}

export default function P03ValidationPage({ repository }: { repository: DemoRepository }): ReactElement {
  const action: AwcpActionRegistration<ProbeInput> = {
    action: 'protocol.validation.probe',
    title: '只读动态条件校验',
    description: describeAction({
      purpose: '按当前虚构人员、会议室、会议占用和演示额度验证请求。',
      prerequisites: '读取动作章节的合法样例，并使用当前 revision。',
      parameters: '人员和会议室为现有 ID，时间为未来 ISO 时段，amountCents 不超过版本 1 的 200000 分。',
      effects: 'validate 只读取快照，invoke 只返回核对结果。',
      result: '返回人员、会议室、时段、金额和演示规则版本。',
      failures: '失效 ID、时间冲突及超额分别返回准确字段路径和消息，执行前无写入。'
    }),
    inputSchema: SCHEMA,
    examples: [EXAMPLE],
    validate: (args) => validate(repository, args),
    invoke: (args) => completed({ ...args, policyVersion: RULE.version })
  };
  useAwcpAction(action);
  return (
    <main className={styles.page}>
      <h1>P03 只读动态校验</h1>
      <p>
        {describePage({
          purpose: '演示依赖当前业务快照的字段校验。',
          regions: '人员 ID、会议时段和版本化演示额度。',
          flow: '按手册样例调用，再改用 EMP-999、冲突时段或 200001 分，观察字段错误。',
          limits: 'validate 和 invoke 均不写入业务状态；额度只作演示。'
        })}
      </p>
      <pre>{JSON.stringify(EXAMPLE, null, 2)}</pre>
      <ul>
        <li>actorId 改为 EMP-999：actorId 路径报告失效 ID。</li>
        <li>时段改为 2026-09-19T02:00:00.000Z～03:00:00.000Z：startAt 路径报告与 MTG-001 冲突。</li>
        <li>amountCents 改为 200001：amountCents 路径报告版本 1 演示额度。</li>
      </ul>
    </main>
  );
}
