import { useAwcpAction } from '@app/awcp';
import type { AwcpActionRegistration, JsonObject } from '@app/awcp';
import { useState, type ReactElement } from 'react';

import { completed, describeAction, describePage } from '../../common/awcp/contracts';
import { runCapacityProbes, type CapacityProbeResult } from '../service/protocolCapacity';
import styles from './P01DiscoveryPage.module.css';

interface PingInput extends JsonObject {
  value: string;
}

export default function P10CapacityPage(): ReactElement {
  const [result, setResult] = useState<CapacityProbeResult | null>(null);
  const [error, setError] = useState('');
  const action: AwcpActionRegistration<PingInput> = {
    action: 'protocol.capacity.ping',
    title: '容量页健康检查',
    description: describeAction({
      purpose: '确认容量实验错误没有破坏当前页面的 Core registry。',
      prerequisites: 'P10 页面已加载。',
      parameters: 'value 是 1 到 20 字的非空文本。',
      effects: '只读回显。',
      result: '返回原文本和当前页面仍可用的标记。',
      failures: '字段错误由 Core 返回 invalid_arguments。'
    }),
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['value'],
      properties: { value: { type: 'string', minLength: 1, maxLength: 20 } }
    },
    examples: [{ value: '页面仍可用' }],
    invoke: (args) => completed({ value: args.value, healthy: true })
  };
  useAwcpAction(action);
  return (
    <main className={styles.page}>
      <h1>P10 容量与隔离</h1>
      <p>
        {describePage({
          purpose: '用真实 Core 私有 registry 验证 Action 数、目录和章节容量。',
          regions: '三个容量探针结果和当前页面健康检查动作。',
          flow: '执行容量探针，查看被拒绝时的原子性，再调用 protocol.capacity.ping 并导航到别页。',
          limits: '超限实验与当前页面 registry 隔离；错误被捕获并显示。'
        })}
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            setResult(runCapacityProbes());
            setError('');
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : '容量探针失败。');
          }
        }}
      >
        执行容量探针
      </button>
      {result && <pre aria-label="容量结果">{JSON.stringify(result, null, 2)}</pre>}
      {error && <p role="alert">{error}</p>}
      <p>当前页只注册 protocol.capacity.ping；私有 registry 的超限错误不会进入页面目录。</p>
    </main>
  );
}
