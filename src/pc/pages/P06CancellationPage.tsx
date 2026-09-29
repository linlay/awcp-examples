import { useAwcpAction } from '@app/awcp';
import type { AwcpActionRegistration, AwcpFieldError, JsonObject } from '@app/awcp';
import { useEffect, useState, type ReactElement } from 'react';

import { completed, describeAction, describePage, fieldError } from '../../common/awcp/contracts';
import type { DemoRepository } from '../../common/store/repository';
import styles from './P01DiscoveryPage.module.css';

interface CommitInput extends JsonObject {
  phase: 'before' | 'during';
  todoId: string;
}
interface StatusInput extends JsonObject {
  todoId: string;
}

const TODO_ID = 'TODO-001';
const COMMIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['phase', 'todoId'],
  properties: {
    phase: { enum: ['before', 'during'] },
    todoId: { type: 'string', const: TODO_ID }
  }
};
const STATUS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['todoId'],
  properties: { todoId: { type: 'string', const: TODO_ID } }
};

class CancellationExperiment {
  private pending = new Set<() => void>();

  constructor(private readonly repository: DemoRepository) {}

  status(): JsonObject {
    const todo = this.repository.snapshot().todos.find((item) => item.id === TODO_ID);
    return { todoId: TODO_ID, status: todo?.status ?? 'missing' };
  }

  validate(input: CommitInput, signal: AbortSignal): AwcpFieldError[] | Promise<AwcpFieldError[]> {
    if (!this.repository.snapshot().todos.some((item) => item.id === input.todoId))
      return [fieldError(['todoId'], '待办不存在。')];
    if (input.phase === 'during') return [];
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve([]);
        return;
      }
      signal.addEventListener('abort', () => resolve([]), { once: true });
    });
  }

  commit(input: CommitInput): Promise<JsonObject> {
    this.repository.transact((state) => {
      const todo = state.todos.find((item) => item.id === input.todoId);
      if (!todo) throw new Error('Demo todo disappeared.');
      todo.status = 'done';
    });
    return new Promise((resolve) => {
      const finish = () => {
        this.pending.delete(finish);
        resolve(completed(this.status()));
      };
      this.pending.add(finish);
    });
  }

  release(): number {
    const count = this.pending.size;
    for (const finish of [...this.pending]) finish();
    return count;
  }
}

export default function P06CancellationPage({ repository }: { repository: DemoRepository }): ReactElement {
  const [experiment] = useState(() => new CancellationExperiment(repository));
  const [released, setReleased] = useState(0);
  const [, setRevision] = useState(0);
  useEffect(() => repository.subscribe(() => setRevision((value) => value + 1)), [repository]);
  const commitAction: AwcpActionRegistration<CommitInput> = {
    action: 'protocol.async.commit',
    title: '可取消的异步待办处理',
    description: describeAction({
      purpose: '演示执行前和执行中取消对本地业务状态的不同影响。',
      prerequisites: `${TODO_ID} 存在；使用唯一 requestId。`,
      parameters: 'phase=before 在只读 validate 阶段等待；phase=during 先把待办标为 done，再等待迟到结果。',
      effects: 'during 模式写入本地待办；取消不回滚该写入。',
      result: '正常释放迟到结果时返回 completed；取消时由 Core 返回 cancelled。',
      failures: '结果未知时先调用 protocol.async.status 查询，不应盲目重试。'
    }),
    inputSchema: COMMIT_SCHEMA,
    examples: [
      { phase: 'before', todoId: TODO_ID },
      { phase: 'during', todoId: TODO_ID }
    ],
    validate: (args, context) => experiment.validate(args, context.signal),
    invoke: (args) => experiment.commit(args)
  };
  useAwcpAction(commitAction);
  const statusAction: AwcpActionRegistration<StatusInput> = {
    action: 'protocol.async.status',
    title: '查询异步任务业务状态',
    description: describeAction({
      purpose: '取消后查询待办实际状态。',
      prerequisites: `${TODO_ID} 存在。`,
      parameters: `todoId 固定为 ${TODO_ID}。`,
      effects: '只读。',
      result: '返回待办 open 或 done 状态。',
      failures: 'ID 不符由 Schema 拒绝。'
    }),
    inputSchema: STATUS_SCHEMA,
    examples: [{ todoId: TODO_ID }],
    invoke: () => completed(experiment.status())
  };
  useAwcpAction(statusAction);

  return (
    <main className={styles.page}>
      <h1>P06 异步取消与迟到结果</h1>
      <p>
        {describePage({
          purpose: '用真实 Core 的取消语义区分执行前与执行中取消。',
          regions: '异步提交、状态查询与迟到结果释放。',
          flow: '发起 before 后取消并查状态；发起 during，确认状态已写入后取消，再查状态与释放结果。',
          limits: '取消不表示业务回滚；未知结果先查状态。'
        })}
      </p>
      <p>当前待办状态：{String(experiment.status().status)}</p>
      <button type="button" onClick={() => setReleased(experiment.release())}>
        释放迟到结果
      </button>
      <p>最近释放的结果数：{released}</p>
      <p>使用 window.awcp.cancel(requestId) 取消在途调用，然后通过 protocol.async.status 查询实际业务状态。</p>
    </main>
  );
}
