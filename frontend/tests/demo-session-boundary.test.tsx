import { StrictMode, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import type { DemoSession } from '@app/api';
import { DemoSessionBoundary } from '../src/app/DemoSessionBoundary';
import { DemoSessionContext } from '../src/app/demoSessionContext';

function Probe() {
  const demo = useContext(DemoSessionContext);
  return <div><span>{demo?.session.generation}</span><button onClick={() => void demo?.reset()}>reset</button></div>;
}
const session = (generation: string): DemoSession => ({ id: 'same-session', generation, seed: 20260919, profile: 'acceptance', datasetVersion: 'test', simulatedAt: '2026-09-19T01:00:00Z', expiresAt: '2026-10-07T00:00:00Z', employees: [], departments: [], recordCount: 48 });
afterEach(() => vi.unstubAllGlobals());

it('coalesces StrictMode bootstrap and remounts children at the workbench after reset', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => new Response(JSON.stringify(session(String(url).endsWith('/reset') ? 'second' : 'first')), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  const container = document.createElement('div');
  const root = createRoot(container);
  const previous = location.href;
  try {
    await act(async () => root.render(<StrictMode><DemoSessionBoundary><Probe /></DemoSessionBoundary></StrictMode>));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('first');
    await act(async () => container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('second');
    expect(location.pathname).toBe('/scenes/O01');
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ 'X-Demo-Generation': 'first' });
  } finally {
    await act(async () => root.unmount());
    history.replaceState(null, '', previous);
  }
});
