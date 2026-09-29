import type { AwcpManualSection } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import P01DiscoveryPage from '../src/pc/pages/P01DiscoveryPage';
import P10CapacityPage from '../src/pc/pages/P10CapacityPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('atomically rejects action, index and section overflows in private real Core registries while the site remains usable', async () => {
  const route = resolveRoute('/scenes/P10');
  const nextRoute = resolveRoute('/scenes/P01');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <AppProviders key={scopeKeyForRoute(route)} site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <P10CapacityPage />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const first = api.manual();
    if (!('sections' in first)) throw new Error('Expected manual index.');
    expect(first.sections).toEqual([{ section: 'protocol.capacity.ping', title: '容量页健康检查' }]);
    const button = [...container.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === '执行容量探针'
    );
    if (!button) throw new Error('Missing capacity probe button.');
    await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const output = container.querySelector('pre[aria-label="容量结果"]')?.textContent;
    if (!output) throw new Error(`Missing probe result: ${container.textContent}`);
    const result = JSON.parse(output) as Record<string, unknown>;
    expect(result.actionCount).toBe(128);
    expect(result.actionError).toContain('128 actions');
    expect(result.actionAtomic).toBe(true);
    expect(result.indexCount).toBeGreaterThan(0);
    expect(result.indexCount).toBeLessThan(128);
    expect(result.indexError).toContain('index');
    expect(result.indexAtomic).toBe(true);
    expect(result.sectionError).toContain('section');
    expect(result.sectionAtomic).toBe(true);
    const current = api.manual();
    if (!('sections' in current)) throw new Error('Expected manual index after probe.');
    expect(current.revision).toBe(first.revision);
    const section = api.manual({
      section: current.sections[0].section,
      revision: current.revision
    }) as AwcpManualSection;
    const args = section.examples?.[0];
    if (!args) throw new Error('Expected ping example.');
    expect(
      await api.invoke({ action: section.section, args, requestId: 'p10-ping', revision: current.revision })
    ).toMatchObject({ ok: true, result: { data: { healthy: true } } });
    await act(async () =>
      root.render(
        <AppProviders
          key={scopeKeyForRoute(nextRoute)}
          site={siteForRoute(nextRoute)}
          scopeKey={scopeKeyForRoute(nextRoute)}
        >
          <P01DiscoveryPage />
        </AppProviders>
      )
    );
    expect(window.awcp?.manual()).toMatchObject({ sections: [{ section: 'protocol.discovery.echo' }] });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
