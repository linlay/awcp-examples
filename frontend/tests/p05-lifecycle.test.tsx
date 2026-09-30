import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import P01DiscoveryPage from '../src/pc/pages/P01DiscoveryPage';
import P05LifecyclePage from '../src/pc/pages/P05LifecyclePage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('registers once in StrictMode, cleans up on disable/unmount and cancels a cross-page call', async () => {
  const route = resolveRoute('/scenes/P05');
  const nextRoute = resolveRoute('/scenes/P01');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <StrictMode>
          <AppProviders key={scopeKeyForRoute(route)} site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
            <P05LifecyclePage />
          </AppProviders>
        </StrictMode>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const manual = () => {
      const value = api.manual();
      if (!('sections' in value)) throw new Error('Expected manual index.');
      return value;
    };
    expect(manual().sections).toEqual([{ section: 'protocol.lifecycle.wait', title: '生命周期等待动作' }]);
    const click = async (label: string) => {
      const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
      if (!button) throw new Error(`Missing button ${label}`);
      await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };
    const beforeDuplicate = manual().revision;
    await click('尝试重复注册');
    expect(container.textContent).toContain('already registered');
    expect(manual().revision).toBe(beforeDuplicate);
    expect(manual().sections).toHaveLength(1);
    await click('停用动作');
    expect(manual().sections).toEqual([]);
    await click('启用动作');
    const active = manual();
    expect(active.sections).toHaveLength(1);
    expect(
      await api.invoke({
        action: 'protocol.lifecycle.wait',
        args: { wait: false },
        requestId: 'p05-immediate',
        revision: active.revision
      })
    ).toMatchObject({ ok: true, result: { data: { waited: false } } });

    const pending = api.invoke({
      action: 'protocol.lifecycle.wait',
      args: { wait: true },
      requestId: 'p05-cross-page',
      revision: active.revision
    });
    await act(async () =>
      root.render(
        <StrictMode>
          <AppProviders
            key={scopeKeyForRoute(nextRoute)}
            site={siteForRoute(nextRoute)}
            scopeKey={scopeKeyForRoute(nextRoute)}
          >
            <P01DiscoveryPage />
          </AppProviders>
        </StrictMode>
      )
    );
    expect(await pending).toMatchObject({ ok: false, error: { code: 'cancelled' } });
    const afterNavigation = window.awcp?.manual();
    expect(afterNavigation).toMatchObject({ sections: [{ section: 'protocol.discovery.echo' }] });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
  expect(window.awcp).toBeUndefined();
});
