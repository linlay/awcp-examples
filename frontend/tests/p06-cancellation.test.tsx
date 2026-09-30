import type { AwcpManualSection } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import P06CancellationPage from '../src/pc/pages/P06CancellationPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('cancels before execution without writes and preserves a committed write after in-flight cancellation', async () => {
  const repository = new DemoRepository();
  const route = resolveRoute('/scenes/P06');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <P06CancellationPage repository={repository} />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = api.manual();
    if (!('sections' in index)) throw new Error('Expected manual index.');
    expect(index.sections.map((item) => item.section)).toEqual(['protocol.async.commit', 'protocol.async.status']);
    const commit = api.manual({ section: 'protocol.async.commit', revision: index.revision }) as AwcpManualSection;
    expect(commit.examples).toEqual([
      { phase: 'before', todoId: 'TODO-001' },
      { phase: 'during', todoId: 'TODO-001' }
    ]);
    const initial = repository.snapshot();
    const before = api.invoke({
      action: 'protocol.async.commit',
      args: { phase: 'before', todoId: 'TODO-001' },
      requestId: 'p06-before',
      revision: index.revision
    });
    expect(api.cancel('p06-before')).toBe(true);
    expect(await before).toMatchObject({ ok: false, error: { code: 'cancelled' } });
    expect(repository.snapshot()).toEqual(initial);

    const during = api.invoke({
      action: 'protocol.async.commit',
      args: { phase: 'during', todoId: 'TODO-001' },
      requestId: 'p06-during',
      revision: index.revision
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(repository.snapshot().todos.find((item) => item.id === 'TODO-001')?.status).toBe('done');
    expect(api.cancel('p06-during')).toBe(true);
    const cancelled = await during;
    expect(cancelled).toMatchObject({ ok: false, error: { code: 'cancelled' } });
    expect(
      await api.invoke({
        action: 'protocol.async.status',
        args: { todoId: 'TODO-001' },
        requestId: 'p06-query',
        revision: index.revision
      })
    ).toMatchObject({ ok: true, result: { data: { status: 'done' } } });
    const button = [...container.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === '释放迟到结果'
    );
    if (!button) throw new Error('Missing release button.');
    await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('最近释放的结果数：1');
    expect(await during).toEqual(cancelled);
    expect(repository.snapshot().todos.find((item) => item.id === 'TODO-001')?.status).toBe('done');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
