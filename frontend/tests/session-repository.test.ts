import { afterEach, expect, it } from 'vitest';
import type { DemoSession } from '@app/api';
import { DEMO_STORAGE_KEY } from '../src/common/store/repository';
import { createSessionRepository } from '../src/pc/service/sessionRepository';

const view = (id: string, generation: string): DemoSession => ({ id, generation, seed: 20260919, datasetVersion: 'test', profile: 'acceptance', simulatedAt: '2026-09-19T01:00:00Z', expiresAt: '2026-10-07T00:00:00Z', employees: [], departments: [], recordCount: 48 });
afterEach(() => localStorage.clear());
it('isolates transitional browser data and leaves the pre-migration key untouched', () => {
  localStorage.setItem(DEMO_STORAGE_KEY, 'pre-existing-user-data');
  const a = createSessionRepository(view('a', 'one'));
  const original = a.snapshot().company.name;
  a.transact((state) => { state.company.name = 'changed'; });
  expect(createSessionRepository(view('a', 'one')).snapshot().company.name).toBe('changed');
  expect(createSessionRepository(view('b', 'one')).snapshot().company.name).toBe(original);
  expect(createSessionRepository(view('a', 'two')).snapshot().company.name).toBe(original);
  // A late callback attached to an obsolete repository cannot modify the new generation.
  a.transact((state) => { state.company.name = 'late'; });
  expect(createSessionRepository(view('a', 'two')).snapshot().company.name).toBe(original);
  expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe('pre-existing-user-data');
});
