import type { AwcpManualSection } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import P04RevisionPage from '../src/pc/pages/P04RevisionPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('keeps revision for ordinary controls and rejects stale revision after contract update', async () => {
  const route = resolveRoute('/scenes/P04');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <P04RevisionPage />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const first = api.manual();
    if (!('sections' in first)) throw new Error('Expected manual index.');
    expect(first.sections).toEqual([{ section: 'protocol.revision.echo', title: '带版本回显' }]);
    const firstSection = api.manual({
      section: first.sections[0].section,
      revision: first.revision
    }) as AwcpManualSection;
    expect(firstSection.examples).toEqual([{ text: '虚构版本一' }]);
    const choose = async (label: string, value: string) => {
      const select = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (!select || !setter) throw new Error(`Missing select ${label}`);
      await act(async () => {
        setter.call(select, value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    const click = async (label: string) => {
      const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
      if (!button) throw new Error(`Missing button ${label}`);
      await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };
    await choose('普通选择', 'B');
    await choose('普通筛选', '仅本组');
    await click('普通刷新');
    const unchanged = api.manual();
    if (!('sections' in unchanged)) throw new Error('Expected manual index.');
    expect(unchanged.revision).toBe(first.revision);
    expect(
      await api.invoke({
        action: firstSection.section,
        args: { text: '普通渲染后' },
        requestId: 'p04-current',
        revision: first.revision
      })
    ).toMatchObject({ ok: true, result: { data: { contractVersion: 1 } } });

    await click('切换合同版本');
    const second = api.manual();
    if (!('sections' in second)) throw new Error('Expected manual index.');
    expect(second.revision).not.toBe(first.revision);
    expect(api.manual({ section: firstSection.section, revision: first.revision })).toMatchObject({
      error: { code: 'stale_revision' }
    });
    expect(
      await api.invoke({
        action: firstSection.section,
        args: { text: '旧样例' },
        requestId: 'p04-stale',
        revision: first.revision
      })
    ).toMatchObject({ ok: false, error: { code: 'stale_revision' } });
    const secondSection = api.manual({
      section: second.sections[0].section,
      revision: second.revision
    }) as AwcpManualSection;
    expect(secondSection.inputSchema).toMatchObject({ required: ['text', 'tag'] });
    expect(secondSection.examples).toEqual([{ text: '虚构版本二', tag: 'reviewed' }]);
    expect(
      await api.invoke({
        action: secondSection.section,
        args: { text: '缺标签' },
        requestId: 'p04-invalid',
        revision: second.revision
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    const args = secondSection.examples?.[0];
    if (!args) throw new Error('Expected updated example.');
    expect(
      await api.invoke({ action: secondSection.section, args, requestId: 'p04-new', revision: second.revision })
    ).toMatchObject({ ok: true, result: { data: { contractVersion: 2, tag: 'reviewed' } } });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
