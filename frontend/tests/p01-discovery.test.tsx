import type { AwcpManualSection } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import P01DiscoveryPage from '../src/pc/pages/P01DiscoveryPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('uses the real Core two-level manual and invokes its example with the current revision', async () => {
  const repository = new DemoRepository();
  const before = repository.snapshot();
  const route = resolveRoute('/scenes/P01');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <P01DiscoveryPage />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = api.manual();
    if (!('sections' in index)) throw new Error('Expected manual index.');
    expect(Object.keys(index).sort()).toEqual(['revision', 'sections', 'site']);
    expect(index.site.name).toContain('P01');
    expect(index.sections).toEqual([{ section: 'protocol.discovery.echo', title: '回显演示输入' }]);
    expect(JSON.stringify(index)).not.toContain('inputSchema');
    expect(JSON.stringify(index)).not.toContain('examples');

    const section = api.manual({ section: index.sections[0].section, revision: index.revision }) as AwcpManualSection;
    expect(Object.keys(section).sort()).toEqual(['description', 'examples', 'inputSchema', 'revision', 'section']);
    expect(section.inputSchema).toMatchObject({ type: 'object', required: ['message', 'repeat'] });
    expect(section.examples).toEqual([{ message: '虚构协议实验', repeat: 2 }]);
    const args = section.examples?.[0];
    if (!args) throw new Error('Expected legal example.');
    expect(
      await api.invoke({ action: section.section, args, requestId: 'p01-success', revision: index.revision })
    ).toMatchObject({
      ok: true,
      result: { status: 'completed', data: { repeated: ['虚构协议实验', '虚构协议实验'] } }
    });
    expect(
      await api.invoke({
        action: section.section,
        args: { repeat: 2 },
        requestId: 'p01-missing',
        revision: index.revision
      })
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid_arguments', details: { executionStarted: false } }
    });
    expect(
      await api.invoke({
        action: section.section,
        args: { ...args, extra: true },
        requestId: 'p01-extra',
        revision: index.revision
      })
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid_arguments', details: { executionStarted: false } }
    });
    expect(
      await api.invoke({
        action: 'protocol.discovery.missing',
        args,
        requestId: 'p01-unknown',
        revision: index.revision
      })
    ).toMatchObject({
      ok: false,
      error: { code: 'action_not_found' }
    });
    expect(repository.snapshot()).toEqual(before);
    expect(container.textContent).toContain('两层发现');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
