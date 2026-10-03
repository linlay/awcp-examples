import type { AwcpFieldError, JsonObject } from '@app/awcp';

import { businessError, fieldError } from '../../common/awcp/contracts';
import type { DemoState, Employee, Todo } from '../../common/fixtures/types';
import type { DemoRepository } from '../../common/store/repository';
import { WorkflowService } from './workflowService';

export interface TodoQueryInput extends JsonObject {
  actorId: string;
}
export interface TodoSummaryInput extends TodoQueryInput {
  date: string;
}
export interface TodoCompleteInput extends TodoQueryInput {
  todoId: string;
  expectedVersion: number;
  idempotencyKey: string;
}
export interface TodoRow extends JsonObject {
  todoId: string;
  title: string;
  assigneeId: string;
  sourceType: Todo['sourceType'];
  sourceId: string;
  dueAt: string;
  priority: 'overdue' | 'today';
  sourceVersion: number | null;
  canComplete: boolean;
}
export interface TodoQueryResult extends JsonObject {
  date: string;
  actorId: string;
  items: TodoRow[];
}
export interface TodoCompleteResult extends JsonObject {
  todoId: string;
  sourceId: string;
  sourceStatus: string;
  businessVersion: number;
}
export interface TodoSummaryRow extends JsonObject {
  todoId: string;
  sourceId: string;
  category: 'done' | 'pending' | 'overdue';
  dueAt: string;
  completedAt: string | null;
}
export interface TodoSummaryResult extends JsonObject {
  date: string;
  actorId: string;
  done: number;
  pending: number;
  overdue: number;
  items: TodoSummaryRow[];
}

export class TodoService {
  private readonly workflow: WorkflowService;

  constructor(private readonly repository: DemoRepository) {
    this.workflow = new WorkflowService(repository);
  }

  subscribe(listener: () => void): () => void {
    return this.repository.subscribe(listener);
  }

  actors(): Array<{ id: string; name: string; departmentId: string }> {
    return this.repository
      .snapshot()
      .employees.filter((item) => item.active)
      .map((item) => ({ id: item.id, name: item.name, departmentId: item.departmentId }));
  }

  validateQuery(input: TodoQueryInput): AwcpFieldError[] {
    return actorErrors(this.repository.snapshot(), input.actorId);
  }

  query(input: TodoQueryInput): TodoQueryResult {
    const state = this.repository.snapshot();
    const actor = validActor(state, input.actorId);
    const now = this.repository.clock.now();
    const date = demoDate(now);
    const items: TodoRow[] = visibleTodos(state, actor)
      .filter((todo) => todo.status === 'open' && demoDate(todo.dueAt) <= date)
      .map((todo): TodoRow => {
        const form = todo.sourceType === 'form' ? state.forms.find((item) => item.id === todo.sourceId) : undefined;
        return {
          todoId: todo.id,
          title: todo.title,
          assigneeId: todo.assigneeId,
          sourceType: todo.sourceType,
          sourceId: todo.sourceId,
          dueAt: todo.dueAt,
          priority: Date.parse(todo.dueAt) < Date.parse(now) ? 'overdue' : 'today',
          sourceVersion: form?.businessVersion ?? null,
          canComplete:
            !!form &&
            (form.kind === 'travel' || form.kind === 'general') &&
            form.status === 'submitted' &&
            actor.id === todo.assigneeId
        };
      })
      .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.todoId.localeCompare(right.todoId));
    return { date, actorId: actor.id, items };
  }

  history(input: TodoQueryInput): Todo[] {
    const state = this.repository.snapshot();
    return visibleTodos(state, validActor(state, input.actorId))
      .filter((todo) => todo.status === 'done')
      .sort((left, right) => (right.completedAt ?? right.dueAt).localeCompare(left.completedAt ?? left.dueAt) || left.id.localeCompare(right.id));
  }

  validateComplete(input: TodoCompleteInput): AwcpFieldError[] {
    return completeErrors(this.repository.snapshot(), input);
  }

  complete(input: TodoCompleteInput): TodoCompleteResult {
    const state = this.repository.snapshot();
    assertValid(completeErrors(state, input));
    const todo = state.todos.find((item) => item.id === input.todoId);
    if (!todo) throw businessError('action.todo-not-found', '待办不存在。');
    const result = this.workflow.transition({
      formId: todo.sourceId,
      actorId: input.actorId,
      action: 'approve',
      expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey
    });
    return {
      todoId: todo.id,
      sourceId: result.formId,
      sourceStatus: result.status,
      businessVersion: result.businessVersion
    };
  }

  validateSummarize(input: TodoSummaryInput): AwcpFieldError[] {
    const errors = actorErrors(this.repository.snapshot(), input.actorId);
    if (!validDate(input.date)) errors.push(fieldError(['date'], '日期须为 YYYY-MM-DD。'));
    return errors;
  }

  summarize(input: TodoSummaryInput): TodoSummaryResult {
    const state = this.repository.snapshot();
    const actor = validActor(state, input.actorId);
    assertValid(this.validateSummarize(input));
    const now = this.repository.clock.now();
    const items: TodoSummaryRow[] = visibleTodos(state, actor)
      .filter((todo) =>
        todo.status === 'done'
          ? demoDate(todo.completedAt ?? todo.dueAt) === input.date
          : demoDate(todo.dueAt) === input.date
      )
      .map((todo) => ({
        todoId: todo.id,
        sourceId: todo.sourceId,
        dueAt: todo.dueAt,
        completedAt: todo.completedAt ?? null,
        category: todo.status === 'done' ? 'done' : Date.parse(todo.dueAt) < Date.parse(now) ? 'overdue' : 'pending'
      }));
    return {
      date: input.date,
      actorId: actor.id,
      done: items.filter((item) => item.category === 'done').length,
      pending: items.filter((item) => item.category === 'pending').length,
      overdue: items.filter((item) => item.category === 'overdue').length,
      items
    };
  }
}

function actorErrors(state: DemoState, actorId: string): AwcpFieldError[] {
  return state.employees.some((item) => item.id === actorId && item.active)
    ? []
    : [fieldError(['actorId'], '操作人不存在或已停用。')];
}

function validActor(state: DemoState, actorId: string): Employee {
  const actor = state.employees.find((item) => item.id === actorId && item.active);
  if (!actor) throw businessError('action.todo-actor-invalid', '操作人不存在或已停用。');
  return actor;
}

function visibleTodos(state: DemoState, actor: Employee): Todo[] {
  return state.todos.filter((todo) => {
    const assignee = state.employees.find((item) => item.id === todo.assigneeId);
    return (
      !!assignee &&
      assignee.active &&
      assignee.departmentId === actor.departmentId &&
      (todo.assigneeId === actor.id || actor.roles.includes('manager'))
    );
  });
}

function completeErrors(state: DemoState, input: TodoCompleteInput): AwcpFieldError[] {
  const errors = actorErrors(state, input.actorId);
  if (typeof input.idempotencyKey !== 'string' || !/^[\w.:-]{1,128}$/.test(input.idempotencyKey))
    errors.push(fieldError(['idempotencyKey'], '业务幂等键格式不正确。'));
  const todo = state.todos.find((item) => item.id === input.todoId);
  if (!todo) return [...errors, fieldError(['todoId'], '待办不存在。')];
  const form = todo.sourceType === 'form' ? state.forms.find((item) => item.id === todo.sourceId) : undefined;
  const record = state.idempotencyRecords.find((item) => item.key === input.idempotencyKey);
  if (record) {
    const fingerprint = JSON.stringify([todo.sourceId, input.actorId, input.expectedVersion]);
    return record.operation === 'form.approve' && record.fingerprint === fingerprint
      ? errors
      : [...errors, fieldError(['idempotencyKey'], '业务幂等键已用于其他操作或参数。')];
  }
  if (todo.status !== 'open') errors.push(fieldError(['todoId'], '待办已处理。'));
  if (todo.assigneeId !== input.actorId) errors.push(fieldError(['actorId'], '只有待办处理人可以完成。'));
  if (!form || (form.kind !== 'travel' && form.kind !== 'general'))
    errors.push(fieldError(['todoId'], '此来源待办须在对应业务页面处理。'));
  if (form && form.status !== 'submitted') errors.push(fieldError(['todoId'], '来源单据当前不可审批。'));
  if (form && form.businessVersion !== input.expectedVersion)
    errors.push(fieldError(['expectedVersion'], '来源业务版本已变化。'));
  return errors;
}

function demoDate(value: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

function validDate(value: string): boolean {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    demoDate(`${value}T00:00:00+08:00`) === value
  );
}

function assertValid(errors: AwcpFieldError[]): void {
  if (errors.length) throw businessError('action.invalid-todo', errors.flatMap((item) => item.messages).join('；'));
}
