import { useAwcpAction, useAwcpRegistry } from '@app/awcp';
import type { AwcpActionRegistration, JsonObject } from '@app/awcp';
import { useState, type ReactElement } from 'react';

import { completed, describeAction, describePage } from '../../common/awcp/contracts';
import styles from './P01DiscoveryPage.module.css';

interface WaitInput extends JsonObject {
  wait: boolean;
}

const ACTION = 'protocol.lifecycle.wait';
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['wait'],
  properties: { wait: { type: 'boolean' } }
};

export default function P05LifecyclePage(): ReactElement {
  const registry = useAwcpRegistry();
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('动作已启用。');
  const action: AwcpActionRegistration<WaitInput> = {
    action: ACTION,
    title: '生命周期等待动作',
    description: describeAction({
      purpose: '演示动作注册、停用、卸载以及跨页时在途请求取消。',
      prerequisites: '动作已启用；等待模式需要通过页面切换或取消结束。',
      parameters: 'wait=false 立即完成；wait=true 持续等待取消。',
      effects: '不写业务数据。',
      result: '立即模式返回 completed；等待模式跨页时由 Core 返回 cancelled。',
      failures: '停用或卸载后动作从目录消失；重复动作 ID 注册原子失败。'
    }),
    inputSchema: SCHEMA,
    examples: [{ wait: false }, { wait: true }],
    invoke: (args, context) => {
      if (!args.wait) return completed({ waited: false });
      return new Promise((resolve) => {
        context.signal.addEventListener('abort', () => resolve(completed({ waited: true })), { once: true });
      });
    }
  };
  useAwcpAction(enabled ? action : null);

  function attemptDuplicate(): void {
    try {
      const handle = registry.register(action);
      handle.unregister();
      setMessage('重复注册意外成功。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '重复注册失败。');
    }
  }

  return (
    <main className={styles.page}>
      <h1>P05 生命周期与多实例</h1>
      <p>
        {describePage({
          purpose: '使用真实 Core 演示严格模式、动作停用、卸载、跨页取消和重复 ID。',
          regions: '动作启停、重复注册按钮与等待样例。',
          flow: '读取目录后停用并复查；启用后发起 wait=true 调用并切换页面。',
          limits: '动作只读；跨页取消不表示业务回滚。'
        })}
      </p>
      <button type="button" onClick={() => setEnabled((value) => !value)}>
        {enabled ? '停用动作' : '启用动作'}
      </button>
      <button type="button" onClick={attemptDuplicate}>
        尝试重复注册
      </button>
      <p role="status">{message}</p>
      <p>等待调用样例：&#123; "wait": true &#125;。导航到另一场景后，旧调用应返回 cancelled。</p>
    </main>
  );
}
