import { useAwcpAction } from '@app/awcp';
import type { AwcpActionRegistration, AwcpFieldError, JsonObject } from '@app/awcp';
import { useState, type ReactElement } from 'react';

import { completed, describeAction, describePage } from '../../common/awcp/contracts';
import styles from './P01DiscoveryPage.module.css';

interface DynamicInput extends JsonObject {
  value: string;
  holdValidation: boolean;
}

function schema(version: 1 | 2) {
  return {
    type: 'object',
    additionalProperties: false,
    required: version === 1 ? ['value', 'holdValidation'] : ['value', 'holdValidation', 'tag'],
    properties: {
      value: { type: 'string', minLength: 1, maxLength: 40 },
      holdValidation: { type: 'boolean' },
      ...(version === 2 ? { tag: { type: 'string', enum: ['current'] } } : {})
    }
  };
}

export default function P09DynamicPage(): ReactElement {
  const [configVersion, setConfigVersion] = useState<1 | 2>(1);
  const [renderCount, setRenderCount] = useState(0);
  const [pending] = useState(() => new Set<() => void>());
  const [released, setReleased] = useState(0);
  const action: AwcpActionRegistration<DynamicInput> = {
    action: 'protocol.dynamic.read',
    title: '动态字段与最新状态',
    description: describeAction({
      purpose: `演示版本 ${configVersion} 的字段配置及最新页面闭包。`,
      prerequisites: '读取当前 revision、Schema 和样例。',
      parameters:
        configVersion === 1 ? 'value 和 holdValidation 必填。' : 'value、holdValidation 与 tag=current 必填。',
      effects: '只读；holdValidation=true 时等待页面按钮释放。',
      result: '返回受理后执行时的配置版本、普通渲染计数和输入值。',
      failures: '合同变化后旧 revision 拒绝新调用；已受理调用按受理时 Schema 检查，按执行时最新闭包返回。'
    }),
    inputSchema: schema(configVersion),
    examples: [
      configVersion === 1
        ? { value: '虚构动态字段', holdValidation: false }
        : { value: '虚构动态字段', holdValidation: false, tag: 'current' }
    ],
    validate: (args) => {
      if (!args.holdValidation) return [];
      return new Promise<AwcpFieldError[]>((resolve) => {
        const finish = () => {
          pending.delete(finish);
          resolve([]);
        };
        pending.add(finish);
      });
    },
    invoke: (args) => completed({ value: args.value, tag: args.tag ?? null, configVersion, renderCount })
  };
  useAwcpAction(action);
  return (
    <main className={styles.page}>
      <h1>P09 动态合同与最新状态</h1>
      <p>
        {describePage({
          purpose: '观察字段配置变化、普通渲染及已受理调用的 Core 行为。',
          regions: '配置版本、渲染计数和释放校验按钮。',
          flow: '先按旧版本受理等待调用，再更新配置，释放校验并比较新旧 revision 与结果。',
          limits: '动作只读；已受理调用不因之后的合同更新自动重新校验旧参数。'
        })}
      </p>
      <p>
        配置版本 {configVersion}；普通渲染计数 {renderCount}。
      </p>
      <button type="button" onClick={() => setRenderCount((value) => value + 1)}>
        普通渲染
      </button>
      <button type="button" onClick={() => setConfigVersion((value) => (value === 1 ? 2 : 1))}>
        更新字段配置
      </button>
      <button
        type="button"
        onClick={() => {
          const count = pending.size;
          for (const finish of [...pending]) finish();
          setReleased(count);
        }}
      >
        释放校验
      </button>
      <p>最近释放的校验数：{released}</p>
    </main>
  );
}
