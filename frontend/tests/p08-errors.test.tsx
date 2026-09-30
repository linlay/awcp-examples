import type { AwcpManualSection } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import P08ErrorsPage from '../src/pc/pages/P08ErrorsPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('preserves controlled action errors and hides ordinary exception details', async () => {
  const route = resolveRoute('/scenes/P08');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <P08ErrorsPage />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = api.manual();
    if (!('sections' in index)) throw new Error('Expected manual index.');
    expect(index.sections).toEqual([{ section: 'protocol.error.demonstrate', title: '受控与普通异常' }]);
    const section = api.manual({ section: index.sections[0].section, revision: index.revision }) as AwcpManualSection;
    expect(section.examples).toEqual([{ mode: 'success' }]);
    const invoke = (mode: string, requestId: string) =>
      api.invoke({ action: section.section, args: { mode }, requestId, revision: index.revision });
    expect(await invoke('success', 'p08-success')).toMatchObject({ ok: true, result: { data: { accepted: true } } });
    expect(await invoke('controlled', 'p08-controlled')).toMatchObject({
      ok: false,
      error: {
        code: 'action.demo-quota-reached',
        message: '虚构演示额度不足。',
        details: { retryable: false, policyVersion: 1 }
      }
    });
    const unexpected = await invoke('unexpected', 'p08-unexpected');
    expect(unexpected).toMatchObject({ ok: false, error: { code: 'execution_failed' } });
    expect(JSON.stringify(unexpected)).not.toContain('INTERNAL_SECRET_P08');
    expect(JSON.stringify(unexpected)).not.toContain('stack');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
