import { useAwcpAction } from '@app/awcp';
import type { AwcpActionRegistration, JsonObject } from '@app/awcp';
import { useState, type ReactElement } from 'react';

import { completed, describeAction, describePage } from '../../common/awcp/contracts';
import styles from './P01DiscoveryPage.module.css';

interface VersionedInput extends JsonObject {
  text: string;
}

function schema(version: 1 | 2) {
  return {
    type: 'object',
    additionalProperties: false,
    required: version === 1 ? ['text'] : ['text', 'tag'],
    properties: {
      text: { type: 'string', minLength: 1, maxLength: 40 },
      ...(version === 2 ? { tag: { type: 'string', enum: ['reviewed'] } } : {})
    }
  };
}

export default function P04RevisionPage(): ReactElement {
  const [contractVersion, setContractVersion] = useState<1 | 2>(1);
  const [selection, setSelection] = useState('A');
  const [filter, setFilter] = useState('全部');
  const [refreshCount, setRefreshCount] = useState(0);
  const action: AwcpActionRegistration<VersionedInput> = {
    action: 'protocol.revision.echo',
    title: '带版本回显',
    description: describeAction({
      purpose: `演示合同版本 ${contractVersion} 的 Schema 与样例更新。`,
      prerequisites: '使用当前页面目录的 revision 读取章节并调用。',
      parameters: contractVersion === 1 ? 'text 为非空字符串。' : 'text 为非空字符串，tag 必须为 reviewed。',
      effects: '只返回输入，不修改业务数据。',
      result: '返回当前合同版本和回显文本。',
      failures: '旧 revision 返回 stale_revision；新 Schema 不符合时返回 invalid_arguments。'
    }),
    inputSchema: schema(contractVersion),
    examples: [contractVersion === 1 ? { text: '虚构版本一' } : { text: '虚构版本二', tag: 'reviewed' }],
    invoke: (args) => completed({ contractVersion, text: args.text, tag: args.tag ?? null })
  };
  useAwcpAction(action);
  return (
    <main className={styles.page}>
      <h1>P04 revision 与合同更新</h1>
      <p>
        {describePage({
          purpose: '对比普通页面渲染与真实 Core 合同更新对 revision 的影响。',
          regions: '选择、筛选、刷新计数和合同版本控制。',
          flow: '记录目录 revision，操作普通控件后再次读取；切换合同版本并尝试旧 revision。',
          limits: '动作只读，合同版本切换仅更新本页注册的 Schema、说明与样例。'
        })}
      </p>
      <label>
        选择
        <select aria-label="普通选择" value={selection} onChange={(event) => setSelection(event.target.value)}>
          <option value="A">A</option>
          <option value="B">B</option>
        </select>
      </label>
      <label>
        筛选
        <select aria-label="普通筛选" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="全部">全部</option>
          <option value="仅本组">仅本组</option>
        </select>
      </label>
      <button type="button" onClick={() => setRefreshCount((value) => value + 1)}>
        普通刷新
      </button>
      <p>
        当前选择 {selection}；筛选 {filter}；刷新 {refreshCount} 次；合同版本 {contractVersion}。
      </p>
      <button type="button" onClick={() => setContractVersion((value) => (value === 1 ? 2 : 1))}>
        切换合同版本
      </button>
      <p>切换到版本 2 后，tag 字段变为必填，样例会更新。旧 revision 的章节读取与调用应失败。</p>
    </main>
  );
}
