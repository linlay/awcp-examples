import { useAwcpAction, type AwcpActionRegistration } from '@app/awcp';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { completed, describeAction } from '../../common/awcp/contracts';
import { TODO_COMPLETE_SCHEMA, TODO_QUERY_SCHEMA, TODO_SUMMARY_SCHEMA } from '../../common/awcp/todoSchemas';
import type { Todo } from '../../common/fixtures/types';
import type { DemoRepository } from '../../common/store/repository';
import { AppLink } from '../components/AppShell';
import { TodoService, type TodoCompleteInput, type TodoQueryInput, type TodoSummaryInput } from '../service/todoService';
import styles from './O01TodoPage.module.css';

const QUERY: TodoQueryInput = { actorId: 'EMP-002' };
const COMPLETE: TodoCompleteInput = { actorId: 'EMP-002', todoId: 'OTODO-002', expectedVersion: 1, idempotencyKey: 'o01-complete-example' };
const SUMMARY: TodoSummaryInput = { actorId: 'EMP-002', date: '2026-09-19' };

function sourcePath(todo: Todo, repository: DemoRepository): string | null {
  const source = encodeURIComponent(todo.sourceId);
  if (todo.sourceType === 'form') return `/scenes/O09/objects/${source}`;
  if (todo.sourceType === 'document') return `/scenes/O06/objects/${source}`;
  if (todo.sourceType === 'client') return `/scenes/S01/objects/${source}`;
  if (todo.sourceType === 'research') return `/scenes/S02/objects/${source}`;
  if (todo.sourceType === 'ib-project') return `/scenes/S03/objects/${source}`;
  if (todo.sourceType === 'meeting') return `/scenes/O05/objects/${source}`;
  if (todo.sourceType === 'approval') return `/scenes/O08/objects/${source}`;
  if (todo.sourceType === 'discussion') {
    const discussion = repository.snapshot().officeDiscussions.find((item) => item.id === todo.sourceId);
    return discussion ? `/scenes/O04/objects/${encodeURIComponent(discussion.id)}` : null;
  }
  return null;
}

export default function O01TodoPage({ repository, navigate, objectId }: { repository: DemoRepository; navigate(path: string): void; objectId?: string }): ReactElement {
  const [service] = useState(() => new TodoService(repository));
  const [actorId, setActorId] = useState('EMP-002');
  const [date, setDate] = useState(() => service.query(QUERY).date);
  const [message, setMessage] = useState('');
  const [, setRevision] = useState(0);
  const keys = useRef(new Map<string, string>());
  useEffect(() => service.subscribe(() => setRevision((value) => value + 1)), [service]);

  const state = repository.snapshot();
  const visible = service.query({ actorId }).items;
  const current = objectId ? state.todos.find((todo) => todo.id === objectId) : undefined;
  const summary = /^\d{4}-\d{2}-\d{2}$/.test(date) ? service.summarize({ actorId, date }) : null;

  const queryAction: AwcpActionRegistration<TodoQueryInput> = {
    action: 'office.todo.query', title: '查询今日待办',
    description: describeAction({ purpose: '查询今天到期和逾期的可见待办。', prerequisites: '现有启用人员；主管可查看本部门待办。', parameters: 'actorId 为操作人。', effects: '只读。', result: '返回来源、优先级和处理状态。', failures: '人员无效时返回字段错误。' }),
    inputSchema: TODO_QUERY_SCHEMA, examples: [QUERY], validate: (args) => service.validateQuery(args), invoke: (args) => completed(service.query(args))
  };
  useAwcpAction(queryAction);
  const completeAction: AwcpActionRegistration<TodoCompleteInput> = {
    action: 'office.todo.complete', title: '处理单据待办',
    description: describeAction({ purpose: '处理本人名下的已提交差旅或通用单据待办。', prerequisites: '其他来源到对应业务详情办理。', parameters: 'todoId、actorId、来源版本和幂等键。', effects: '批准来源单据并关闭待办。', result: '返回单据状态和版本。', failures: '非处理人、旧版本或不支持来源返回字段错误。' }),
    inputSchema: TODO_COMPLETE_SCHEMA, examples: [COMPLETE], validate: (args) => service.validateComplete(args), invoke: (args) => completed(service.complete(args))
  };
  useAwcpAction(completeAction);
  const summaryAction: AwcpActionRegistration<TodoSummaryInput> = {
    action: 'office.todo.summarize', title: '汇总待办日报',
    description: describeAction({ purpose: '按日期统计已办、待办和逾期。', prerequisites: '有效日期和操作人。', parameters: 'actorId 与 YYYY-MM-DD 日期。', effects: '只读。', result: '返回计数和明细。', failures: '人员或日期无效时返回字段错误。' }),
    inputSchema: TODO_SUMMARY_SCHEMA, examples: [SUMMARY], validate: (args) => service.validateSummarize(args), invoke: (args) => completed(service.summarize(args))
  };
  useAwcpAction(summaryAction);

  function complete(row: (typeof visible)[number]): void {
    const key = `${row.todoId}:${row.sourceVersion}:${actorId}`;
    if (!keys.current.has(key)) keys.current.set(key, `o01-ui-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    try {
      const result = service.complete({ todoId: row.todoId, actorId, expectedVersion: row.sourceVersion ?? 0, idempotencyKey: keys.current.get(key) ?? '' });
      setMessage(`${row.title}已处理；来源单据状态 ${result.sourceStatus}，版本 ${result.businessVersion}。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : '处理失败。'); }
  }

  return <section className={styles.page} aria-label="工作台与待办">
    <p className={styles.eyebrow}>O01 · 工作台与待办</p>
    <h1>{current ? current.title : '我的待办与业务入口'}</h1>
    <p>根据任务进入对应业务表单；提交后在业务详情页继续办理。</p>
    <nav className={styles.launch} aria-label="发起业务流程">
      <AppLink href="/scenes/O08/new/approval" navigate={navigate}>发起通用审批</AppLink>
      <AppLink href="/scenes/O09/new/travel" navigate={navigate}>发起出差申请</AppLink>
      <AppLink href="/scenes/O11/new/purchase" navigate={navigate}>创建请购单</AppLink>
      <AppLink href="/scenes/O10/new/leave" navigate={navigate}>提交休假申请</AppLink>
    </nav>
    <div className={styles.filters}>
      <label>操作人 <select value={actorId} onChange={(event) => setActorId(event.target.value)}>{service.actors().map((actor) => <option key={actor.id} value={actor.id}>{actor.name}（{actor.id}）</option>)}</select></label>
      <label>日报日期 <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    </div>
    {current ? <article className={styles.card}>
      <p>事项编号 {current.id} · {current.status === 'open' ? '待处理' : '已办结'} · 到期 {current.dueAt}</p>
      <p>来源：{current.sourceType} · {current.sourceId}；负责人 {current.assigneeId}</p>
      {sourcePath(current, repository) && <AppLink href={sourcePath(current, repository) ?? ''} navigate={navigate}>查看来源业务详情 →</AppLink>}
      {visible.filter((row) => row.todoId === current.id && row.canComplete).map((row) => <button key={row.todoId} type="button" onClick={() => complete(row)}>处理待办</button>)}
      <AppLink href="/scenes/O01" navigate={navigate}>返回待办列表</AppLink>
    </article> : <ul className={styles.list}>{visible.map((row) => <li key={row.todoId} className={styles.card}>
      <AppLink href={`/scenes/O01/objects/${encodeURIComponent(row.todoId)}`} navigate={navigate}><strong>{row.title}</strong></AppLink>
      <span>{row.todoId} · {row.priority === 'overdue' ? '逾期' : '今日'} · {row.sourceId}</span>
      {row.canComplete && <button type="button" onClick={() => complete(row)}>处理待办</button>}
    </li>)}</ul>}
    {summary && <p>日报：已办 {summary.done} · 待办 {summary.pending} · 逾期 {summary.overdue}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
