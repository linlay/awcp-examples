import { afterEach, expect, it, vi } from 'vitest';
import type { WorkspaceEvent } from '@app/api';
import { RealtimeService } from '../src/pc/service/realtimeService';
const event = (revision: number, resources = ['reports']): WorkspaceEvent => ({
  id: `w:${revision}`,
  workspaceId: 'w',
  generation: 'g',
  revision,
  type: 'business.changed',
  source: 'mcp',
  resources
});
afterEach(() => vi.useRealTimers());

it('updates only observed resources and coalesces repeated and duplicate events', async () => {
  vi.useFakeTimers();
  const sync = new RealtimeService('auto');
  const refresh = vi.fn().mockResolvedValue(3);
  sync.observe('report', { resources: ['reports'], revision: 0, refresh });
  sync.receive(event(1, ['approvals']));
  await vi.advanceTimersByTimeAsync(400);
  expect(refresh).not.toHaveBeenCalled();
  sync.receive(event(2));
  sync.receive(event(3));
  sync.receive(event(3));
  await vi.advanceTimersByTimeAsync(400);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(sync.snapshot().pending).toBe(0);
  sync.receive(event(2));
  await vi.advanceTimersByTimeAsync(400);
  expect(refresh).toHaveBeenCalledTimes(1);
  sync.dispose();
});
it('acknowledges each query separately for events before or after its HTTP response', async () => {
  vi.useFakeTimers();
  const sync = new RealtimeService('auto');
  const a = vi.fn().mockResolvedValue(4),
    b = vi.fn().mockResolvedValue(4);
  sync.observe('a', { resources: ['reports'], revision: 0, refresh: a });
  sync.observe('b', { resources: ['reports'], revision: 0, refresh: b });
  sync.receive(event(4));
  sync.acknowledge('a', 4);
  await vi.advanceTimersByTimeAsync(400);
  expect(a).not.toHaveBeenCalled();
  expect(b).toHaveBeenCalledTimes(1);
  sync.acknowledge('a', 5);
  sync.receive(event(5));
  expect(sync.snapshot().pending).toBe(1);
  sync.dispose();
});
it('preserves notify/off modes and defers hidden, paused or dirty observers', async () => {
  vi.useFakeTimers();
  const sync = new RealtimeService();
  const refresh = vi.fn().mockResolvedValue(1);
  let dirty = true;
  sync.observe('a', { resources: ['reports'], revision: 0, refresh, dirty: () => dirty });
  sync.receive(event(1));
  await vi.advanceTimersByTimeAsync(400);
  expect(refresh).not.toHaveBeenCalled();
  await sync.refresh();
  expect(refresh).not.toHaveBeenCalled();
  dirty = false;
  sync.setVisible(false);
  sync.setMode('auto');
  await vi.advanceTimersByTimeAsync(400);
  expect(refresh).not.toHaveBeenCalled();
  sync.setPaused(true);
  sync.setVisible(true);
  await vi.advanceTimersByTimeAsync(400);
  expect(refresh).not.toHaveBeenCalled();
  sync.setPaused(false);
  sync.setMode('off');
  await vi.advanceTimersByTimeAsync(400);
  expect(refresh).not.toHaveBeenCalled();
  sync.setMode('notify');
  await sync.refresh();
  expect(refresh).toHaveBeenCalledTimes(1);
  sync.dispose();
});
it('keeps updates pending on failure and on an older returned snapshot', async () => {
  vi.useFakeTimers();
  const sync = new RealtimeService('auto');
  const refresh = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(1)
    .mockResolvedValue(2);
  sync.observe('a', { resources: ['reports'], revision: 0, refresh });
  sync.receive(event(2));
  await vi.advanceTimersByTimeAsync(400);
  expect(sync.snapshot()).toMatchObject({ pending: 1, error: true });
  await sync.refresh();
  expect(sync.snapshot().pending).toBe(1);
  await sync.refresh();
  expect(sync.snapshot()).toMatchObject({ pending: 0, error: false });
  sync.dispose();
});
it('does not acknowledge a different observer mounted while a request is in flight', async () => {
  const sync = new RealtimeService();
  let resolve: (value: number) => void = () => undefined;
  const unmount = sync.observe('a', {
    resources: ['reports'],
    revision: 0,
    refresh: () =>
      new Promise<number>((r) => {
        resolve = r;
      })
  });
  sync.receive(event(3));
  const pending = sync.refresh();
  unmount();
  sync.observe('a', { resources: ['reports'], revision: 0, refresh: async () => 3 });
  resolve(3);
  await pending;
  expect(sync.snapshot().pending).toBe(1);
  sync.dispose();
});
