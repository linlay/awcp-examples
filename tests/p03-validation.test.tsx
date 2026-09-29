import type { AwcpManualSection, JsonObject } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import P03ValidationPage from '../src/pc/pages/P03ValidationPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('uses current read-only state for invalid ID, date conflict and demo quota errors', async () => {
  const repository = new DemoRepository();
  const before = repository.snapshot();
  const route = resolveRoute('/scenes/P03');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <P03ValidationPage repository={repository} />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = api.manual();
    if (!('sections' in index)) throw new Error('Expected manual index.');
    expect(index.sections).toEqual([{ section: 'protocol.validation.probe', title: '只读动态条件校验' }]);
    const section = api.manual({ section: index.sections[0].section, revision: index.revision }) as AwcpManualSection;
    const valid = section.examples?.[0];
    if (!valid) throw new Error('Expected legal example.');
    let count = 0;
    const invoke = (args: JsonObject) =>
      api.invoke({ action: section.section, args, requestId: `p03-${++count}`, revision: index.revision });
    expect(await invoke(valid)).toMatchObject({ ok: true, result: { data: { policyVersion: 1 } } });
    for (const item of [
      { args: { ...valid, actorId: 'EMP-999' }, path: ['actorId'], message: '不存在' },
      {
        args: { ...valid, startAt: '2026-09-19T02:00:00.000Z', endAt: '2026-09-19T03:00:00.000Z' },
        path: ['startAt'],
        message: 'MTG-001'
      },
      { args: { ...valid, amountCents: 200_001 }, path: ['amountCents'], message: '演示额度' }
    ]) {
      const response = await invoke(item.args);
      expect(response).toMatchObject({
        ok: false,
        error: { code: 'invalid_arguments', details: { executionStarted: false } }
      });
      if (response.ok) throw new Error('Expected validation failure.');
      expect(JSON.stringify(response.error.details)).toContain(item.message);
      expect(response.error.details).toMatchObject({ fieldErrors: [expect.objectContaining({ path: item.path })] });
      expect(repository.snapshot()).toEqual(before);
    }
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
