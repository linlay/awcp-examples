import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { TodoService } from '../src/pc/service/todoService';

it('queries only visible due items using the fixed Shanghai date and priority order', () => {
  const repository = new DemoRepository();
  const service = new TodoService(repository);
  expect(service.query({ actorId: 'EMP-002' })).toMatchObject({
    date: '2026-09-19',
    items: [
      { todoId: 'OTODO-002', sourceId: 'OFFORM-001', priority: 'overdue', canComplete: true },
      { todoId: 'APPTODO-001', sourceId: 'APPR-001', priority: 'today', canComplete: false },
      { todoId: 'TODO-001', sourceId: 'FORM-001', priority: 'today', canComplete: true, sourceVersion: 1 }
    ]
  });
  expect(service.query({ actorId: 'EMP-003' }).items.map((item) => item.todoId)).toEqual(['OTODO-001']);
  expect(service.query({ actorId: 'EMP-001' }).items).toEqual([]);
  expect(service.validateQuery({ actorId: 'EMP-999' }).map((item) => item.path)).toEqual([['actorId']]);
});

it('completes the source form once, rejects stale and foreign work, and summarizes detail counts', () => {
  const repository = new DemoRepository();
  const service = new TodoService(repository);
  const input = { actorId: 'EMP-002', todoId: 'OTODO-002', expectedVersion: 1, idempotencyKey: 'o01-service-complete' };
  const initial = repository.snapshot();
  expect(service.validateComplete({ ...input, actorId: 'EMP-003' }).map((item) => item.path)).toContainEqual([
    'actorId'
  ]);
  expect(service.validateComplete({ ...input, expectedVersion: 2 }).map((item) => item.path)).toContainEqual([
    'expectedVersion'
  ]);
  expect(service.validateComplete({ ...input, todoId: 'OTODO-001' }).map((item) => item.path)).toContainEqual([
    'todoId'
  ]);
  expect(service.validateComplete({ ...input, todoId: 'APPTODO-001' }).map((item) => item.path)).toContainEqual([
    'todoId'
  ]);
  expect(repository.snapshot()).toEqual(initial);
  expect(service.summarize({ actorId: 'EMP-002', date: '2026-09-19' })).toMatchObject({
    done: 2,
    pending: 2,
    overdue: 1
  });
  expect(service.complete(input)).toMatchObject({
    todoId: 'OTODO-002',
    sourceId: 'OFFORM-001',
    sourceStatus: 'approved',
    businessVersion: 2
  });
  expect(service.complete(input).businessVersion).toBe(2);
  expect(repository.snapshot().forms.find((item) => item.id === 'OFFORM-001')?.status).toBe('approved');
  expect(repository.snapshot().todos.find((item) => item.id === 'OTODO-002')).toMatchObject({
    status: 'done',
    completedAt: repository.clock.now()
  });
  expect(
    repository.snapshot().auditEntries.filter((item) => item.entityId === 'OFFORM-001' && item.action === 'approve')
  ).toHaveLength(1);
  const summary = service.summarize({ actorId: 'EMP-002', date: '2026-09-19' });
  expect(summary).toMatchObject({ done: 3, pending: 2, overdue: 0 });
  expect(summary.done + summary.pending + summary.overdue).toBe(summary.items.length);
  expect(service.query({ actorId: 'EMP-002' }).items.map((item) => item.todoId)).toEqual(['APPTODO-001', 'TODO-001']);
  expect(
    service.validateComplete({ ...input, idempotencyKey: 'o01-second-complete' }).map((item) => item.path)
  ).toContainEqual(['todoId']);
  expect(service.validateSummarize({ actorId: 'EMP-002', date: '2026-02-30' }).map((item) => item.path)).toEqual([
    ['date']
  ]);
});
