import { useAwcpAction } from '@app/awcp';
import type { AwcpActionRegistration } from '@app/awcp';
import { useEffect, useState, type ReactElement } from 'react';

import { completed, describeAction, describePage } from '../../common/awcp/contracts';
import type { DemoRepository } from '../../common/store/repository';
import { InstitutionService, type NeedReviseInput } from '../service/institutionService';
import styles from './P01DiscoveryPage.module.css';

interface ReviseInput extends NeedReviseInput {
  hold: boolean;
}

const EXAMPLE: ReviseInput = {
  actorId: 'EMP-001',
  needId: 'SNEED-003',
  materialIds: ['SMAT-001'],
  reason: '改用范围内资料',
  expectedVersion: 2,
  idempotencyKey: 'p07-business-1',
  hold: true
};
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'needId', 'materialIds', 'reason', 'expectedVersion', 'idempotencyKey', 'hold'],
  properties: {
    actorId: { type: 'string', pattern: '^EMP-[0-9]{3}$' },
    needId: { type: 'string', pattern: '^SNEED-[0-9]{3}$' },
    materialIds: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { type: 'string', pattern: '^SMAT-[0-9]{3}$' }
    },
    reason: { type: 'string', minLength: 1, maxLength: 200 },
    expectedVersion: { type: 'integer', minimum: 1 },
    idempotencyKey: { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' },
    hold: { type: 'boolean' }
  }
};

function businessInput(input: ReviseInput): NeedReviseInput {
  const { hold: _hold, ...data } = input;
  return data;
}

export default function P07IdempotencyPage({ repository }: { repository: DemoRepository }): ReactElement {
  const [service] = useState(() => new InstitutionService(repository));
  const [pending] = useState(() => new Set<() => void>());
  const [released, setReleased] = useState(0);
  const [, setRevision] = useState(0);
  useEffect(() => repository.subscribe(() => setRevision((value) => value + 1)), [repository]);
  const action: AwcpActionRegistration<ReviseInput> = {
    action: 'protocol.idempotency.revise',
    title: '带业务幂等键的需求补正',
    description: describeAction({
      purpose: '对比 Core 在途 requestId 去重与 S05 业务幂等键。',
      prerequisites: 'SNEED-003 初始为 returned、版本 2；使用 EMP-001 与 SMAT-001。',
      parameters: 'requestId 在调用信封中；业务 idempotencyKey 在参数中；hold=true 保持第一次响应在途。',
      effects: '合法新业务键补正需求并递增 businessVersion；相同业务键和参数返回原结果。',
      result: '返回需求状态、业务版本和关联路演 ID。',
      failures: '在途相同 requestId 返回 duplicate_request；同业务键异参返回字段错误。'
    }),
    inputSchema: SCHEMA,
    examples: [EXAMPLE],
    validate: (args) => service.validateRevise(businessInput(args)),
    invoke: (args) => {
      const result = completed(service.revise(businessInput(args)));
      if (!args.hold) return result;
      return new Promise((resolve) => {
        const finish = () => {
          pending.delete(finish);
          resolve(result);
        };
        pending.add(finish);
      });
    }
  };
  useAwcpAction(action);
  const need = service.snapshot().institutionNeeds.find((item) => item.id === 'SNEED-003');
  return (
    <main className={styles.page}>
      <h1>P07 重复请求与业务幂等</h1>
      <p>
        {describePage({
          purpose: '区分在途 requestId 去重和持久的业务幂等键。',
          regions: 'SNEED-003 当前版本、合法样例与释放响应按钮。',
          flow: '先发起 hold=true 调用，再以同 requestId 重复；释放后复用 requestId 但换业务键，再用原业务键重放。',
          limits: '业务写入发生在响应释放前；结果未知时应先查询业务状态。'
        })}
      </p>
      <pre>{JSON.stringify(EXAMPLE, null, 2)}</pre>
      <p>
        SNEED-003：{need?.status}；版本 {need?.businessVersion}。
      </p>
      <button
        type="button"
        onClick={() => {
          const count = pending.size;
          for (const finish of [...pending]) finish();
          setReleased(count);
        }}
      >
        释放在途响应
      </button>
      <p>最近释放的响应数：{released}</p>
    </main>
  );
}
