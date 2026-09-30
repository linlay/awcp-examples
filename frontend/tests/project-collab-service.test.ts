import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { ProjectCollabService } from '../src/pc/service/projectCollabService';

it('creates projects and tasks with valid members, deadlines and same-project dependencies', () => {
  const repository = new DemoRepository();
  const service = new ProjectCollabService(repository);
  const project = {
    actorId: 'EMP-001',
    title: '虚构办公升级项目',
    memberIds: ['EMP-001', 'EMP-003'],
    dueDate: '2026-10-10',
    idempotencyKey: 'project-create'
  };
  const before = repository.snapshot();
  expect(() =>
    service.createProject({ ...project, memberIds: ['EMP-003'], idempotencyKey: 'missing-owner' })
  ).toThrow();
  expect(() => service.createProject({ ...project, dueDate: '2026-09-18', idempotencyKey: 'past-project' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  const created = service.createProject(project);
  expect(created).toMatchObject({ id: 'PRJ-002', status: 'active', businessVersion: 1 });
  expect(service.createProject(project)).toEqual(created);
  const task = {
    actorId: 'EMP-001',
    projectId: created.id,
    title: '虚构交付演练',
    assigneeId: 'EMP-003',
    dueDate: '2026-09-30',
    dependencyIds: [] as string[],
    idempotencyKey: 'task-create'
  };
  const afterProject = repository.snapshot();
  expect(() =>
    service.createTask({ ...task, dependencyIds: ['PTASK-001'], idempotencyKey: 'cross-project' })
  ).toThrow();
  expect(() => service.createTask({ ...task, assigneeId: 'EMP-002', idempotencyKey: 'non-member' })).toThrow();
  expect(repository.snapshot()).toEqual(afterProject);
  expect(service.createTask(task)).toMatchObject({ id: 'PTASK-004', status: 'open', businessVersion: 1 });
  expect(repository.snapshot().projectTasks[3]).toMatchObject({
    projectId: 'PRJ-002',
    assigneeId: 'EMP-003',
    dueDate: '2026-09-30',
    dependencyIds: []
  });
});

it('rejects cycles and stale task versions while milestones recompute from task state', () => {
  const repository = new DemoRepository();
  const service = new ProjectCollabService(repository);
  const initial = service.read({ actorId: 'EMP-001' });
  expect(initial.milestones).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'PMS-001', status: 'completed' }),
      expect.objectContaining({ id: 'PMS-002', status: 'overdue' })
    ])
  );
  const before = repository.snapshot();
  expect(() =>
    service.updateTask({
      actorId: 'EMP-001',
      taskId: 'PTASK-001',
      title: '整理虚构需求',
      assigneeId: 'EMP-001',
      dueDate: '2026-09-18',
      dependencyIds: ['PTASK-003'],
      status: 'done',
      expectedVersion: 2,
      idempotencyKey: 'task-cycle'
    })
  ).toThrow();
  expect(() =>
    service.updateTask({
      actorId: 'EMP-003',
      taskId: 'PTASK-002',
      title: '联调',
      assigneeId: 'EMP-003',
      dueDate: '2026-09-18',
      dependencyIds: ['PTASK-001'],
      status: 'done',
      expectedVersion: 9,
      idempotencyKey: 'stale-task'
    })
  ).toThrow();
  expect(() =>
    service.updateTask({
      actorId: 'EMP-002',
      taskId: 'PTASK-003',
      title: '验收',
      assigneeId: 'EMP-002',
      dueDate: '2026-09-25',
      dependencyIds: ['PTASK-002'],
      status: 'done',
      expectedVersion: 1,
      idempotencyKey: 'unfinished-dependency'
    })
  ).toThrow();
  expect(repository.snapshot()).toEqual(before);
  expect(
    service.updateTask({
      actorId: 'EMP-003',
      taskId: 'PTASK-002',
      title: '完成虚构界面联调',
      assigneeId: 'EMP-003',
      dueDate: '2026-09-18',
      dependencyIds: ['PTASK-001'],
      status: 'done',
      expectedVersion: 1,
      idempotencyKey: 'finish-task-2'
    })
  ).toMatchObject({
    id: 'PTASK-002',
    status: 'done',
    businessVersion: 2
  });
  expect(service.read({ actorId: 'EMP-001' }).milestones).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'PMS-002', status: 'in-progress' })])
  );
  expect(
    service.updateTask({
      actorId: 'EMP-002',
      taskId: 'PTASK-003',
      title: '验收虚构演示',
      assigneeId: 'EMP-002',
      dueDate: '2026-09-25',
      dependencyIds: ['PTASK-002'],
      status: 'done',
      expectedVersion: 1,
      idempotencyKey: 'finish-task-3'
    })
  ).toMatchObject({
    id: 'PTASK-003',
    status: 'done',
    businessVersion: 2
  });
  expect(service.read({ actorId: 'EMP-001' }).milestones).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'PMS-002', status: 'completed' })])
  );
});

it('upserts milestone task lists with optimistic versions and project ownership', () => {
  const repository = new DemoRepository();
  const service = new ProjectCollabService(repository);
  const input = {
    actorId: 'EMP-001',
    projectId: 'PRJ-001',
    milestoneId: null,
    expectedVersion: null,
    title: '虚构培训准备',
    dueDate: '2026-09-27',
    taskIds: ['PTASK-001', 'PTASK-002'],
    idempotencyKey: 'milestone-create'
  };
  const before = repository.snapshot();
  expect(() => service.upsertMilestone({ ...input, taskIds: ['PTASK-999'], idempotencyKey: 'missing-task' })).toThrow();
  expect(() => service.upsertMilestone({ ...input, actorId: 'EMP-003', idempotencyKey: 'non-owner' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  expect(service.upsertMilestone(input)).toMatchObject({ id: 'PMS-003', status: 'overdue', businessVersion: 1 });
  expect(() =>
    service.upsertMilestone({ ...input, milestoneId: 'PMS-003', expectedVersion: 9, idempotencyKey: 'stale-milestone' })
  ).toThrow();
  expect(
    service.upsertMilestone({
      ...input,
      milestoneId: 'PMS-003',
      expectedVersion: 1,
      taskIds: ['PTASK-001'],
      idempotencyKey: 'milestone-update'
    })
  ).toMatchObject({
    id: 'PMS-003',
    status: 'completed',
    businessVersion: 2
  });
});

it('generates current weekly facts and keeps older incomplete and overdue task IDs traceable', () => {
  const repository = new DemoRepository();
  const service = new ProjectCollabService(repository);
  const input = { actorId: 'EMP-001', projectId: 'PRJ-001', idempotencyKey: 'report-before' };
  const before = repository.snapshot();
  expect(() => service.generateReport({ ...input, actorId: 'EMP-003', idempotencyKey: 'non-owner-report' })).toThrow();
  expect(repository.snapshot()).toEqual(before);
  expect(service.generateReport(input)).toMatchObject({ id: 'PWREP-001', status: 'generated' });
  expect(service.generateReport(input)).toMatchObject({ id: 'PWREP-001', status: 'generated' });
  expect(repository.snapshot().projectWeeklyReports[0]).toMatchObject({
    weekStart: '2026-09-14',
    weekEnd: '2026-09-20',
    incompleteTaskIds: ['PTASK-002', 'PTASK-003'],
    overdueTaskIds: ['PTASK-002'],
    taskFacts: expect.arrayContaining([
      expect.objectContaining({ id: 'PTASK-002', businessVersion: 1, status: 'open' })
    ])
  });
  service.updateTask({
    actorId: 'EMP-003',
    taskId: 'PTASK-002',
    title: '完成虚构界面联调',
    assigneeId: 'EMP-003',
    dueDate: '2026-09-18',
    dependencyIds: ['PTASK-001'],
    status: 'done',
    expectedVersion: 1,
    idempotencyKey: 'report-finish-task'
  });
  expect(service.generateReport({ ...input, idempotencyKey: 'report-after' })).toMatchObject({
    id: 'PWREP-002',
    status: 'generated'
  });
  expect(repository.snapshot().projectWeeklyReports[0].overdueTaskIds).toEqual(['PTASK-002']);
  expect(repository.snapshot().projectWeeklyReports[1]).toMatchObject({
    incompleteTaskIds: ['PTASK-003'],
    overdueTaskIds: [],
    taskFacts: expect.arrayContaining([
      expect.objectContaining({ id: 'PTASK-002', businessVersion: 2, status: 'done' })
    ])
  });
});
