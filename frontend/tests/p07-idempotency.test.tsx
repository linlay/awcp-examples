import type { AwcpManualSection } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import P07IdempotencyPage from '../src/pc/pages/P07IdempotencyPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('separates in-flight requestId rejection from later requestId reuse and business-key replay', async () => {
  const repository = new DemoRepository();
  const route = resolveRoute('/scenes/P07');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <P07IdempotencyPage repository={repository} />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = api.manual();
    if (!('sections' in index)) throw new Error('Expected manual index.');
    expect(index.sections).toEqual([{ section: 'protocol.idempotency.revise', title: '带业务幂等键的需求补正' }]);
    const section = api.manual({ section: index.sections[0].section, revision: index.revision }) as AwcpManualSection;
    const firstArgs = section.examples?.[0];
    if (!firstArgs) throw new Error('Expected legal example.');
    const invoke = (args: typeof firstArgs, requestId: string) =>
      api.invoke({ action: section.section, args, requestId, revision: index.revision });
    const invokeSettled = async (args: typeof firstArgs, requestId: string) => {
      let response: Awaited<ReturnType<typeof invoke>> | undefined;
      await act(async () => {
        response = await invoke(args, requestId);
      });
      if (!response) throw new Error('Missing AWCP response.');
      return response;
    };
    let pending: ReturnType<typeof invoke> | undefined;
    await act(async () => {
      pending = invoke(firstArgs, 'p07-shared-request');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (!pending) throw new Error('Missing pending invocation.');
    expect(repository.snapshot().institutionNeeds.find((item) => item.id === 'SNEED-003')?.businessVersion).toBe(3);
    expect(await invokeSettled(firstArgs, 'p07-shared-request')).toMatchObject({
      ok: false,
      error: { code: 'duplicate_request' }
    });
    const release = [...container.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === '释放在途响应'
    );
    if (!release) throw new Error('Missing release button.');
    await act(async () => release.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(await pending).toMatchObject({ ok: true, result: { data: { businessVersion: 3 } } });
    expect(
      await invokeSettled(
        { ...firstArgs, expectedVersion: 3, idempotencyKey: 'p07-business-2', hold: false },
        'p07-shared-request'
      )
    ).toMatchObject({ ok: true, result: { data: { businessVersion: 4 } } });
    expect(repository.snapshot().institutionNeeds.find((item) => item.id === 'SNEED-003')?.businessVersion).toBe(4);
    expect(await invokeSettled({ ...firstArgs, hold: false }, 'p07-new-request')).toMatchObject({
      ok: true,
      result: { data: { businessVersion: 3 } }
    });
    expect(repository.snapshot().institutionNeeds.find((item) => item.id === 'SNEED-003')?.businessVersion).toBe(4);
    expect(
      await invokeSettled({ ...firstArgs, reason: '异参重放', hold: false }, 'p07-invalid-business-key')
    ).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    expect(
      repository
        .snapshot()
        .auditEntries.filter((item) => item.entityType === 'institution-need' && item.entityId === 'SNEED-003')
    ).toHaveLength(2);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
