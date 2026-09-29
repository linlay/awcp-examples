import type { AwcpManualSection, JsonObject } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DEMO_STORAGE_KEY } from '../src/common/store/repository';
import P02SchemaPage from '../src/pc/pages/P02SchemaPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('reports static field paths for missing, type, extra and nested array errors before execution', async () => {
  const route = resolveRoute('/scenes/P02');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const storageBefore = window.localStorage.getItem(DEMO_STORAGE_KEY);
  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <P02SchemaPage />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = api.manual();
    if (!('sections' in index)) throw new Error('Expected manual index.');
    expect(index.sections).toEqual([{ section: 'protocol.schema.preview', title: '验证嵌套资料草稿' }]);
    const section = api.manual({ section: index.sections[0].section, revision: index.revision }) as AwcpManualSection;
    expect(section.inputSchema).toMatchObject({ type: 'object', required: ['draft'] });
    const valid = section.examples?.[0];
    if (!valid) throw new Error('Expected legal example.');
    let count = 0;
    const invoke = (args: JsonObject) =>
      api.invoke({ action: section.section, args, requestId: `p02-${++count}`, revision: index.revision });
    expect(await invoke(valid)).toMatchObject({
      ok: true,
      result: { status: 'completed', data: { title: '虚构资料预览', lineCount: 1, totalQuantity: 2 } }
    });
    const invalid: Array<{ args: JsonObject; path: Array<string | number> }> = [
      { args: { draft: { lines: [{ materialId: 'SMAT-001', quantity: 2 }] } }, path: ['draft', 'title'] },
      {
        args: { draft: { title: '虚构资料预览', lines: [{ materialId: 'SMAT-001', quantity: '2' }] } },
        path: ['draft', 'lines', 0, 'quantity']
      },
      {
        args: { draft: { title: '虚构资料预览', lines: [{ materialId: 'SMAT-001', quantity: 2 }], extra: true } },
        path: ['draft', 'extra']
      },
      {
        args: { draft: { title: '虚构资料预览', lines: [{ materialId: 'SMAT-001', quantity: 2 }, { quantity: 1 }] } },
        path: ['draft', 'lines', 1, 'materialId']
      }
    ];
    for (const item of invalid)
      expect(await invoke(item.args)).toMatchObject({
        ok: false,
        error: {
          code: 'invalid_arguments',
          details: { executionStarted: false, fieldErrors: [{ path: item.path, messages: [expect.any(String)] }] }
        }
      });
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBe(storageBefore);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
