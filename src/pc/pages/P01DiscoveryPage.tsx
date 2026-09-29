import { useAwcpAction } from '@app/awcp';
import type { AwcpActionRegistration, JsonObject } from '@app/awcp';
import { useState, type ReactElement } from 'react';

import { completed, describeAction, describePage } from '../../common/awcp/contracts';
import styles from './P01DiscoveryPage.module.css';

interface EchoInput extends JsonObject {
  message: string;
  repeat: number;
}

const ECHO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'repeat'],
  properties: {
    message: { type: 'string', minLength: 1, maxLength: 40 },
    repeat: { type: 'integer', minimum: 1, maximum: 3 }
  }
};
const ECHO_EXAMPLE: EchoInput = { message: '虚构协议实验', repeat: 2 };

function echo(input: EchoInput): JsonObject {
  return { message: input.message, repeated: Array.from({ length: input.repeat }, () => input.message) };
}

export default function P01DiscoveryPage(): ReactElement {
  const [preview, setPreview] = useState<JsonObject>(() => echo(ECHO_EXAMPLE));
  const action: AwcpActionRegistration<EchoInput> = {
    action: 'protocol.discovery.echo',
    title: '回显演示输入',
    description: describeAction({
      purpose: '演示两层手册发现后按 Schema 调用动作。',
      prerequisites: '先获取当前页面目录 revision 和该动作的手册章节。',
      parameters: 'message 为 1 到 40 字，repeat 为 1 到 3 的整数。',
      effects: '只计算回显结果，不修改演示数据。',
      result: '返回原消息和重复结果数组。',
      failures: '字段缺失、类型、范围或额外字段错误返回 invalid_arguments；未知动作返回 action_not_found。'
    }),
    inputSchema: ECHO_SCHEMA,
    examples: [ECHO_EXAMPLE],
    invoke: (args) => completed(echo(args))
  };
  useAwcpAction(action);

  return (
    <main className={styles.page}>
      <h1>P01 两层发现与标准调用</h1>
      <p>
        {describePage({
          purpose: '使用真实 Core 演示页面目录、动作章节和标准调用。',
          regions: '目录字段、章节样例、调用结果与预期错误。',
          flow: '先读取目录 revision，再读取 protocol.discovery.echo 章节，最后以相同 revision 调用样例。',
          limits: '回显为只读实验，不写入业务数据。'
        })}
      </p>
      <ol>
        <li>调用 window.awcp.manual()；目录只列出页面信息和动作名称、标题。</li>
        <li>
          用目录中的 revision 调用 manual(&#123; section: 'protocol.discovery.echo', revision &#125;) 获取 inputSchema
          和 examples。
        </li>
        <li>使用同一个 revision 与章节样例调用 invoke；应返回 completed 和回显数组。</li>
        <li>移除 message 或增加 extra 字段，应得到 invalid_arguments 且 executionStarted=false。</li>
      </ol>
      <p>合法输入样例：</p>
      <pre>{JSON.stringify(ECHO_EXAMPLE, null, 2)}</pre>
      <button type="button" onClick={() => setPreview(echo(ECHO_EXAMPLE))}>
        本地预览相同结果
      </button>
      <pre aria-label="回显预览">{JSON.stringify(preview, null, 2)}</pre>
    </main>
  );
}
