import type { AwcpActionResponse, AwcpManualSection, JsonObject } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import O01TodoPage from '../src/pc/pages/O01TodoPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

function render(repository: DemoRepository, container: HTMLDivElement) {
  const route = resolveRoute('/scenes/O01');
  const root = createRoot(container);
  return {
    root,
    element: (
      <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
        <O01TodoPage repository={repository} navigate={() => undefined} />
      </AppProviders>
    )
  };
}

it('discovers O01 actions through Core manual and shares query, completion and summary state', async () => {
  const repository = new DemoRepository();
  const container = document.createElement('div');
  document.body.append(container);
  const { root, element } = render(repository, container);
  try {
    await act(async () => root.render(element));
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = api.manual();
    if (!('sections' in index)) throw new Error('Expected manual index.');
    const actions = ['office.todo.query', 'office.todo.complete', 'office.todo.summarize'];
    for (const action of actions) expect(index.sections.some((item) => item.section === action)).toBe(true);
    const example = (action: string): JsonObject => {
      const section = api.manual({ section: action, revision: index.revision }) as AwcpManualSection;
      const item = section.examples?.[0];
      if (!item) throw new Error(`Missing example for ${action}`);
      return item;
    };
    let count = 0;
    const invoke = async (action: string, args: JsonObject): Promise<AwcpActionResponse> => {
      let response: AwcpActionResponse | undefined;
      await act(async () => {
        response = await api.invoke({ action, args, requestId: `o01-awcp-${++count}`, revision: index.revision });
      });
      if (!response) throw new Error('No response.');
      return response;
    };
    const query = await invoke('office.todo.query', example('office.todo.query'));
    expect(query).toMatchObject({
      ok: true,
      result: {
        data: {
          date: '2026-09-19',
          items: [
            expect.objectContaining({ todoId: 'OTODO-002' }),
            expect.objectContaining({ todoId: 'APPTODO-001', sourceId: 'APPR-001', canComplete: false }),
            expect.objectContaining({ todoId: 'TODO-001', sourceId: 'FORM-001' })
          ]
        }
      }
    });
    const hidden = await invoke('office.todo.query', { actorId: 'EMP-003' });
    expect(hidden).toMatchObject({
      ok: true,
      result: { data: { items: [expect.objectContaining({ todoId: 'OTODO-001' })] } }
    });
    const initial = repository.snapshot();
    expect(
      await invoke('office.todo.complete', {
        ...example('office.todo.complete'),
        actorId: 'EMP-003',
        idempotencyKey: 'o01-wrong-actor'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid_arguments', details: { executionStarted: false } } });
    expect(repository.snapshot()).toEqual(initial);
    expect(await invoke('office.todo.complete', example('office.todo.complete'))).toMatchObject({
      ok: true,
      result: { data: { todoId: 'OTODO-002', sourceStatus: 'approved', businessVersion: 2 } }
    });
    expect(await invoke('office.todo.complete', example('office.todo.complete'))).toMatchObject({
      ok: true,
      result: { data: { businessVersion: 2 } }
    });
    expect(await invoke('office.todo.summarize', example('office.todo.summarize'))).toMatchObject({
      ok: true,
      result: { data: { done: 3, pending: 2, overdue: 0 } }
    });
    expect(
      await invoke('office.todo.summarize', { ...example('office.todo.summarize'), date: '2026-02-30' })
    ).toMatchObject({ ok: false, error: { code: 'invalid_arguments', details: { executionStarted: false } } });
    expect(container.textContent).toContain('已办 3 · 待办 2 · 逾期 0');
    const after = api.manual();
    if (!('sections' in after)) throw new Error('Expected manual index after calls.');
    expect(after.revision).toBe(index.revision);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it('processes the fixed form todo from the page control', async () => {
  const repository = new DemoRepository();
  const container = document.createElement('div');
  document.body.append(container);
  const { root, element } = render(repository, container);
  try {
    await act(async () => root.render(element));
    const row = [...container.querySelectorAll('tbody tr')].find((item) => item.textContent?.includes('OTODO-002'));
    const button = row?.querySelector('button');
    if (!button) throw new Error('Todo completion button is missing.');
    await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(repository.snapshot().forms.find((item) => item.id === 'OFFORM-001')?.status).toBe('approved');
    expect(container.textContent).toContain('已办 3 · 待办 2 · 逾期 0');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
