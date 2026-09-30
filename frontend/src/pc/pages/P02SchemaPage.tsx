import { useAwcpAction } from '@app/awcp';
import type { AwcpActionRegistration, JsonObject } from '@app/awcp';
import type { ReactElement } from 'react';

import { completed, describeAction, describePage } from '../../common/awcp/contracts';
import styles from './P01DiscoveryPage.module.css';

interface SchemaPreviewInput extends JsonObject {
  draft: { title: string; lines: Array<{ materialId: string; quantity: number }> };
}

const EXAMPLE: SchemaPreviewInput = {
  draft: { title: '虚构资料预览', lines: [{ materialId: 'SMAT-001', quantity: 2 }] }
};
const SCHEMA = {
  type: 'object',
  required: ['draft'],
  additionalProperties: false,
  properties: {
    draft: {
      type: 'object',
      required: ['title', 'lines'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 40 },
        lines: {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: {
            type: 'object',
            required: ['materialId', 'quantity'],
            additionalProperties: false,
            properties: {
              materialId: { type: 'string', pattern: '^SMAT-[0-9]{3}$' },
              quantity: { type: 'integer', minimum: 1, maximum: 10 }
            }
          }
        }
      }
    }
  }
};

export default function P02SchemaPage(): ReactElement {
  const action: AwcpActionRegistration<SchemaPreviewInput> = {
    action: 'protocol.schema.preview',
    title: '验证嵌套资料草稿',
    description: describeAction({
      purpose: '演示真实 Core 对嵌套对象与数组执行静态 Schema 校验。',
      prerequisites: '读取当前页面手册章节中的 Schema 和合法样例。',
      parameters: 'draft.title 为非空短文本；lines 含 1 到 5 个资料行，行内有 materialId 和 1 到 10 的整数数量。',
      effects: '只计算资料行数量与合计数量，不修改业务数据。',
      result: '返回标题、资料行数与合计数量。',
      failures: '缺字段、错误类型、额外字段或嵌套行错误返回 invalid_arguments，executionStarted=false。'
    }),
    inputSchema: SCHEMA,
    examples: [EXAMPLE],
    invoke: (args) =>
      completed({
        title: args.draft.title,
        lineCount: args.draft.lines.length,
        totalQuantity: args.draft.lines.reduce((total, line) => total + line.quantity, 0)
      })
  };
  useAwcpAction(action);
  return (
    <main className={styles.page}>
      <h1>P02 Schema 与字段错误</h1>
      <p>
        {describePage({
          purpose: '用真实 Core 验证缺字段、类型、额外字段和嵌套数组错误。',
          regions: '合法资料草稿与四类错误样例。',
          flow: '先读取 protocol.schema.preview 章节，再以当前 revision 分别调用合法和非法样例。',
          limits: '动作只计算预览结果；所有错误均在执行前被拦截。'
        })}
      </p>
      <pre>{JSON.stringify(EXAMPLE, null, 2)}</pre>
      <ul>
        <li>删除 draft.title：缺少必填字段。</li>
        <li>把 quantity 改成字符串：类型错误。</li>
        <li>添加 draft.extra：额外字段错误。</li>
        <li>第二个 lines 项缺少 materialId：嵌套数组路径错误。</li>
      </ul>
      <p>每次失败应返回字段路径、错误消息与 executionStarted=false；业务状态不变。</p>
    </main>
  );
}
