import { expect, it } from 'vitest';

import { createSeedState } from '../src/common/fixtures/seed';
import { DEMO_STORAGE_KEY, DemoRepository, type DemoStorage } from '../src/common/store/repository';
import { TravelService, type TravelSubmitInput } from '../src/pc/service/travelService';
import { WorkflowService } from '../src/pc/service/workflowService';

const validInput: TravelSubmitInput = {
  actorId: 'EMP-001',
  departmentId: 'DEP-001',
  travelerIds: ['EMP-001', 'EMP-002'],
  origin: '上海',
  destination: '北京',
  startAt: '2026-09-24T09:00:00+08:00',
  endAt: '2026-09-25T18:00:00+08:00',
  estimatedAmountCents: 180000,
  idempotencyKey: 'travel-service-001'
};

class MemoryStorage implements DemoStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

it('submits one linked form, trip, todo and audit entry for one business intent', () => {
  const repository = new DemoRepository();
  const service = new TravelService(repository);
  expect(service.validate(validInput)).toEqual([]);
  expect(repository.snapshot().travelRequests).toHaveLength(1);
  const result = service.submit(validInput);
  expect(result).toEqual({ formId: 'FORM-003', status: 'submitted', businessVersion: 1 });
  expect(service.submit(validInput)).toEqual(result);
  const state = repository.snapshot();
  expect(state.forms.filter((item) => item.id === result.formId)).toHaveLength(1);
  expect(state.travelRequests.find((item) => item.formId === result.formId)).toMatchObject({
    destination: '北京',
    travelerIds: ['EMP-001', 'EMP-002']
  });
  expect(state.todos.filter((todo) => todo.sourceId === result.formId)).toEqual([
    expect.objectContaining({ assigneeId: 'EMP-002', status: 'open' })
  ]);
  expect(state.auditEntries.filter((entry) => entry.entityId === result.formId)).toEqual([
    expect.objectContaining({ action: 'travel-submit', actorId: 'EMP-001', businessVersion: 1 })
  ]);
  expect(service.list().find((item) => item.formId === result.formId)?.status).toBe('submitted');
  expect(
    new WorkflowService(repository).transition({
      formId: result.formId,
      actorId: 'EMP-002',
      action: 'approve',
      expectedVersion: 1,
      idempotencyKey: 'approve-trip-003'
    }).status
  ).toBe('approved');
  expect(service.list().find((item) => item.formId === result.formId)?.status).toBe('approved');
});

it('rejects reversed dates, invalid personnel and stale business keys without any writes', () => {
  const repository = new DemoRepository();
  const service = new TravelService(repository);
  const initial = repository.snapshot();
  const reversed = { ...validInput, endAt: '2026-09-23T18:00:00+08:00' };
  expect(service.validate(reversed)).toEqual([expect.objectContaining({ path: ['endAt'] })]);
  expect(() => service.submit(reversed)).toThrow('结束时间必须晚于开始时间');
  expect(service.validate({ ...validInput, travelerIds: ['EMP-003'] }).map((error) => error.path)).toEqual([
    ['travelerIds', 0],
    ['travelerIds']
  ]);
  expect(() => service.submit({ ...validInput, actorId: 'EMP-003' })).toThrow('部门必须与当前申请人一致');
  expect(() => service.submit({ ...validInput, startAt: '2026-02-30T09:00:00+08:00' })).toThrow('有效的未来时间');
  expect(repository.snapshot()).toEqual(initial);

  const result = service.submit(validInput);
  const saved = repository.snapshot();
  expect(service.validate({ ...validInput, destination: '深圳' }).map((error) => error.path)).toEqual([
    ['idempotencyKey']
  ]);
  expect(() => service.submit({ ...validInput, destination: '深圳' })).toThrow('幂等键已用于其他操作');
  expect(repository.snapshot()).toEqual(saved);
  expect(result.formId).toBe('FORM-003');
});

it('migrates the older stored graph without replacing existing records', () => {
  const storage = new MemoryStorage();
  const old = createSeedState();
  old.forms[0].amountCents = 4321;
  const legacy = { ...old, schemaVersion: 2 };
  delete (legacy as Partial<typeof old>).travelRequests;
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(legacy));
  const repository = new DemoRepository({ storage });
  expect(repository.snapshot().travelRequests.map((item) => item.formId)).toEqual(['FORM-001']);
  expect(repository.snapshot().forms[0].amountCents).toBe(4321);
  expect(JSON.parse(storage.getItem(DEMO_STORAGE_KEY) ?? '{}').schemaVersion).toBe(2);
  const result = new TravelService(repository).submit(validInput);
  const restored = new DemoRepository({ storage }).snapshot();
  expect(restored.schemaVersion).toBe(24);
  expect(restored.travelRequests.map((item) => item.formId)).toEqual(['FORM-001', result.formId]);
  expect(restored.forms[0].amountCents).toBe(4321);
});
