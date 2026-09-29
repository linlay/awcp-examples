import { useAwcpAction } from '@app/awcp';
import type { AwcpActionRegistration, JsonObject } from '@app/awcp';
import type { ReactElement } from 'react';

import { businessError, completed, describeAction, describePage } from '../../common/awcp/contracts';
import styles from './P01DiscoveryPage.module.css';

interface ErrorInput extends JsonObject {
  mode: 'success' | 'controlled' | 'unexpected';
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mode'],
  properties: { mode: { enum: ['success', 'controlled', 'unexpected'] } }
};

export default function P08ErrorsPage(): ReactElement {
  const action: AwcpActionRegistration<ErrorInput> = {
    action: 'protocol.error.demonstrate',
    title: '受控与普通异常',
    description: describeAction({
      purpose: '比较受控 action.* 业务错误和普通异常的协议响应。',
      prerequisites: '读取当前章节 Schema 与成功样例。',
      parameters: 'mode=success 返回成功；controlled 抛受控业务错误；unexpected 抛普通异常。',
      effects: '只读，不写业务状态。',
      result: '成功时返回 completed；受控错误保留业务代码、消息和安全详情。',
      failures: '普通异常统一返回 execution_failed，不暴露内部错误文本或堆栈。'
    }),
    inputSchema: SCHEMA,
    examples: [{ mode: 'success' }],
    invoke: (args) => {
      if (args.mode === 'controlled')
        throw businessError('action.demo-quota-reached', '虚构演示额度不足。', { retryable: false, policyVersion: 1 });
      if (args.mode === 'unexpected') throw new Error('INTERNAL_SECRET_P08: hidden implementation stack');
      return completed({ accepted: true });
    }
  };
  useAwcpAction(action);
  return (
    <main className={styles.page}>
      <h1>P08 受控错误与异常归一</h1>
      <p>
        {describePage({
          purpose: '隔离演示真实 Core 对业务错误和普通异常的处理。',
          regions: '成功、受控错误和普通异常三种模式。',
          flow: '按章节样例调用成功后，分别把 mode 改为 controlled 与 unexpected。',
          limits: '普通异常只用于演示归一处理，不写业务数据。'
        })}
      </p>
      <pre>{JSON.stringify({ mode: 'success' }, null, 2)}</pre>
      <ul>
        <li>controlled：返回 action.demo-quota-reached、安全业务消息和策略版本。</li>
        <li>unexpected：返回 execution_failed，不应包含内部异常文本或堆栈。</li>
      </ul>
    </main>
  );
}
