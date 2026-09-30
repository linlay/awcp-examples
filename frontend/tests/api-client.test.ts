import { describe, expect, it, vi } from 'vitest';
import { ApiError, DemoApi, type DemoSession, type ReportFilter } from '@app/api';

const session = (generation: string): DemoSession => ({ id: 'session', generation, seed: 20260919, profile: 'acceptance', datasetVersion: 'test', simulatedAt: '2026-09-19T01:00:00Z', expiresAt: '2026-10-07T00:00:00Z', employees: [], departments: [], recordCount: 48 });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const filter: ReportFilter = { from: '', to: '', departmentId: '', scenarioId: '', status: '', groupBy: 'month', page: 1, pageSize: 20 };

describe('same-origin demo API', () => {
  it('coalesces initial session requests and includes generation on business requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(session('one')));
    const api = new DemoApi(fetcher);
    const [a, b] = await Promise.all([api.session(), api.session()]);
    expect(a).toEqual(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(json({ generation: 'one' }));
    await api.report(filter);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ credentials: 'same-origin', headers: { 'X-Demo-Generation': 'one' } });
  });

  it('retries an uncertain reset with the original request key and generation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(json(session('two')));
    const api = new DemoApi(fetcher);
    api.adoptSession(session('one'));
    await expect(api.reset()).rejects.toThrow('offline');
    expect(await api.reset()).toMatchObject({ generation: 'two' });
    expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body);
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ 'X-Demo-Generation': 'one' });
  });

  it('does not deliver old results even when transport ignores AbortSignal', async () => {
    let release: ((value: Response) => void) | undefined;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const api = new DemoApi(fetcher);
    api.adoptSession(session('one'));
    const pending = api.report(filter);
    api.adoptSession(session('two'));
    release?.(json({ generation: 'one' }));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('preserves structured API errors and propagates caller cancellation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ code: 'session.generation-conflict', message: '已重置' }, 409));
    const api = new DemoApi(fetcher);
    api.adoptSession(session('one'));
    await expect(api.report(filter)).rejects.toBeInstanceOf(ApiError);
    const controller = new AbortController();
    controller.abort();
    fetcher.mockImplementation(async (_url, init) => {
      expect(init?.signal?.aborted).toBe(true);
      throw new DOMException('cancelled', 'AbortError');
    });
    await expect(api.report(filter, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
