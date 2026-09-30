import type { AwcpManualSection } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import P09DynamicPage from '../src/pc/pages/P09DynamicPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('updates schema/examples, keeps latest closure on ordinary render and completes an accepted call under Core rules', async () => {
  const route = resolveRoute('/scenes/P09');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <P09DynamicPage />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = () => {
      const value = api.manual();
      if (!('sections' in value)) throw new Error('Expected manual index.');
      return value;
    };
    const first = index();
    expect(first.sections).toEqual([{ section: 'protocol.dynamic.read', title: '动态字段与最新状态' }]);
    const section = api.manual({ section: first.sections[0].section, revision: first.revision }) as AwcpManualSection;
    expect(section.examples).toEqual([{ value: '虚构动态字段', holdValidation: false }]);
    const click = async (label: string) => {
      const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
      if (!button) throw new Error(`Missing button ${label}`);
      await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };
    expect(
      await api.invoke({
        action: section.section,
        args: { value: '初始', holdValidation: false },
        requestId: 'p09-initial',
        revision: first.revision
      })
    ).toMatchObject({ ok: true, result: { data: { configVersion: 1, renderCount: 0 } } });
    await click('普通渲染');
    expect(index().revision).toBe(first.revision);
    expect(
      await api.invoke({
        action: section.section,
        args: { value: '刷新后', holdValidation: false },
        requestId: 'p09-render',
        revision: first.revision
      })
    ).toMatchObject({ ok: true, result: { data: { configVersion: 1, renderCount: 1 } } });

    const pending = api.invoke({
      action: section.section,
      args: { value: '旧合同受理', holdValidation: true },
      requestId: 'p09-pending',
      revision: first.revision
    });
    await act(async () => {
      await Promise.resolve();
    });
    await click('更新字段配置');
    const second = index();
    expect(second.revision).not.toBe(first.revision);
    expect(
      await api.invoke({
        action: section.section,
        args: { value: '旧 revision', holdValidation: false },
        requestId: 'p09-stale',
        revision: first.revision
      })
    ).toMatchObject({ ok: false, error: { code: 'stale_revision' } });
    const updated = api.manual({ section: section.section, revision: second.revision }) as AwcpManualSection;
    expect(updated.inputSchema).toMatchObject({ required: ['value', 'holdValidation', 'tag'] });
    expect(updated.examples).toEqual([{ value: '虚构动态字段', holdValidation: false, tag: 'current' }]);
    expect(
      await api.invoke({
        action: section.section,
        args: { value: '无标签', holdValidation: false },
        requestId: 'p09-invalid',
        revision: second.revision
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid_arguments' } });
    const newArgs = updated.examples?.[0];
    if (!newArgs) throw new Error('Expected updated example.');
    expect(
      await api.invoke({ action: section.section, args: newArgs, requestId: 'p09-current', revision: second.revision })
    ).toMatchObject({ ok: true, result: { data: { configVersion: 2, renderCount: 1, tag: 'current' } } });
    await click('释放校验');
    expect(await pending).toMatchObject({
      ok: true,
      result: { data: { configVersion: 2, renderCount: 1, tag: null, value: '旧合同受理' } }
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
