import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import type { DemoSession } from '@app/api';
import { DemoSessionBoundary } from '../src/app/DemoSessionBoundary';
import { useDemoSession } from '../src/pc/hooks/useDemoSession';
import { RealtimeControls } from '../src/pc/components/RealtimeControls';

class Stream extends EventTarget {
  static instances: Stream[] = [];
  onerror: (() => void) | null = null;
  closed = false;
  readyState = 1;
  constructor(readonly url: string) {
    super();
    Stream.instances.push(this);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  emit(type: string, value: unknown) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(value) }));
  }
}
const session = (generation: string, revision: number): DemoSession => ({
  id: 'workspace',
  generation,
  revision,
  eventCursor: `workspace:${revision}`,
  seed: 1,
  profile: 'acceptance',
  datasetVersion: 'test',
  simulatedAt: '2026-10-03',
  expiresAt: '2026-10-10',
  employees: [],
  departments: [],
  recordCount: 48
});
function Probe() {
  const demo = useDemoSession();
  const [draft, setDraft] = useState('unsaved input');
  return (
    <>
      <RealtimeControls />
      <input aria-label="draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <span>{demo?.session.generation}</span>
      <button onClick={() => void demo?.reset()}>own-reset</button>
      <button onClick={() => setDraft(String(demo?.api.canWriteSession('workspace', demo.session.generation)))}>
        can-write
      </button>
    </>
  );
}
const containers: { root: ReturnType<typeof createRoot>; node: HTMLElement }[] = [];
const computedStyle = window.getComputedStyle.bind(window);
afterEach(async () => {
  for (const { root, node } of containers.splice(0)) {
    await act(async () => root.unmount());
    node.remove();
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  sessionStorage.clear();
  Stream.instances = [];
});
async function mount() {
  vi.stubGlobal('EventSource', Stream);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => computedStyle(element));
  const node = document.createElement('div');
  document.body.append(node);
  const root = createRoot(node);
  containers.push({ root, node });
  await act(async () =>
    root.render(
      <DemoSessionBoundary>
        <Probe />
      </DemoSessionBoundary>
    )
  );
  return node;
}
it('retains mounted drafts and blocks stale writes until the user confirms a remote reset', async () => {
  let current = session('old', 0);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(current)))
  );
  const node = await mount();
  current = session('new', 1);
  await act(async () =>
    Stream.instances[0].emit('change', {
      id: 'workspace:1',
      workspaceId: 'workspace',
      generation: 'new',
      revision: 1,
      type: 'workspace.reset',
      source: 'mcp',
      resources: ['workspace', 'reports']
    })
  );
  expect(node.textContent).toContain('当前输入已保留');
  expect(node.textContent).toContain('old');
  expect(node.querySelector('input')?.value).toBe('unsaved input');
  await act(async () =>
    Array.from(node.querySelectorAll('button'))
      .find((button) => button.textContent === 'can-write')
      ?.click()
  );
  expect(node.querySelector('input')?.value).toBe('false');
  await act(async () =>
    Array.from(node.querySelectorAll('button'))
      .find((button) => button.textContent === '载入最新数据')
      ?.click()
  );
  await act(async () =>
    Array.from(document.querySelectorAll('[role="dialog"] button'))
      .find((button) => button.textContent?.replace(/\s/g, '') === '确认载入')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  );
  expect(node.textContent).toContain('new');
  expect(node.querySelector('input')?.value).toBe('unsaved input');
});
it('keeps mode changes local to one mounted tab and closes its SSE stream', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(session('g', 0))))
  );
  const a = await mount(),
    b = await mount();
  const select = a.querySelector('select');
  if (!select) throw new Error('Missing sync selector');
  await act(async () => {
    select.value = 'off';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(Stream.instances[0].closed).toBe(true);
  expect(Stream.instances[1].closed).toBe(false);
  expect(b.querySelector('select')?.value).toBe('notify');
  expect(sessionStorage.getItem('awcp:realtime-mode')).toBe('off');
});
it('ignores its own early reset event and adopts the HTTP response without a second session request', async () => {
  const fetcher = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).endsWith('/reset')) {
      const operationId = JSON.parse(String(options?.body)).requestId as string;
      Stream.instances[0].emit('change', {
        id: 'workspace:1',
        workspaceId: 'workspace',
        generation: 'new',
        revision: 1,
        type: 'workspace.reset',
        source: 'browser',
        operationId,
        resources: ['reports', 'workspace']
      });
      return new Response(JSON.stringify({ ...session('new', 1), operationId }));
    }
    return new Response(JSON.stringify(session('old', 0)));
  });
  vi.stubGlobal('fetch', fetcher);
  const node = await mount();
  await act(async () =>
    Array.from(node.querySelectorAll('button'))
      .find((button) => button.textContent === 'own-reset')
      ?.click()
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(node.textContent).toContain('new');
  expect(node.textContent).not.toContain('当前输入已保留');
});

it('refreshes credentials after a terminal SSE failure and reconnects with backoff', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => new Response(JSON.stringify(session('g', 0))));
  vi.stubGlobal('fetch', fetcher);
  await mount();
  await act(async () => {
    Stream.instances[0].readyState = 2;
    Stream.instances[0].onerror?.();
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(Stream.instances).toHaveLength(1);
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(Stream.instances[0].closed).toBe(true);
  expect(Stream.instances).toHaveLength(2);
});
