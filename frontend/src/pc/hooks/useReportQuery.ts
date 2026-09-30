import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoApi, ReportFilter, ReportResult } from '@app/api';

export function useReportQuery(api: DemoApi) {
  const [result, setResult] = useState<ReportResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef<AbortController>();
  const query = useCallback(async (filter: ReportFilter, signal?: AbortSignal) => {
    latest.current?.abort();
    const controller = new AbortController();
    latest.current = controller;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    setLoading(true);
    setError('');
    try {
      const next = await api.report(filter, controller.signal);
      if (controller.signal.aborted || latest.current !== controller) throw new DOMException('请求已取消。', 'AbortError');
      setResult(next);
      return next;
    } catch (error) {
      if (latest.current === controller && !controller.signal.aborted) setError(error instanceof Error ? error.message : '查询失败，请重试。');
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      if (latest.current === controller) setLoading(false);
    }
  }, [api]);
  useEffect(() => () => { latest.current?.abort(); latest.current = undefined; }, []);
  return { result, loading, error, query };
}
