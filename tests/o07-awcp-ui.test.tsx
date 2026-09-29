import type { AwcpActionResponse, AwcpManualSection, JsonObject } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import O07SheetPage from '../src/pc/pages/O07SheetPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('discovers O07 through both Core manual levels and invokes all four actions with failure branches', async () => {
  const repository = new DemoRepository();
  const container = document.createElement('div');
  document.body.append(container);
  const route = resolveRoute('/scenes/O07');
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <O07SheetPage repository={repository} />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = api.manual();
    if (!('sections' in index)) throw new Error('Expected manual index.');
    const actions = [
      'office.sheet.query',
      'office.sheet.rows.patch',
      'office.sheet.import.check',
      'office.sheet.export.start'
    ];
    for (const action of actions) expect(index.sections.some((item) => item.section === action)).toBe(true);
    const example = (action: string): JsonObject => {
      const section = api.manual({ section: action, revision: index.revision }) as AwcpManualSection;
      const item = section.examples?.[0];
      if (!item) throw new Error(`Missing example: ${action}`);
      return item;
    };
    let count = 0;
    const invoke = async (action: string, args: JsonObject): Promise<AwcpActionResponse> => {
      let response: AwcpActionResponse | undefined;
      await act(async () => {
        response = await api.invoke({ action, args, requestId: `o07-awcp-${++count}`, revision: index.revision });
      });
      if (!response) throw new Error(`No response: ${action}`);
      return response;
    };
    expect(await invoke('office.sheet.query', example('office.sheet.query'))).toMatchObject({
      ok: true,
      result: {
        data: { total: 5, page: 1, pageSize: 3, items: [{ id: 'SROW-001' }, { id: 'SROW-002' }, { id: 'SROW-003' }] }
      }
    });
    expect(await invoke('office.sheet.query', { ...example('office.sheet.query'), page: 0 })).toMatchObject({
      ok: false,
      error: { code: 'invalid_arguments', details: { executionStarted: false } }
    });
    const before = repository.snapshot();
    const patch = example('office.sheet.rows.patch');
    expect(
      await invoke('office.sheet.rows.patch', {
        ...patch,
        idempotencyKey: 'o07-invalid',
        changes: [(patch.changes as JsonObject[])[0], { ...(patch.changes as JsonObject[])[1], expectedVersion: 99 }]
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid_arguments', details: { executionStarted: false } } });
    expect(repository.snapshot()).toEqual(before);
    expect(await invoke('office.sheet.import.check', example('office.sheet.import.check'))).toMatchObject({
      ok: true,
      result: { data: { rowCount: 2, validCount: 1, imported: false, errorRows: [{ rowNumber: 2 }] } }
    });
    expect(repository.snapshot()).toEqual(before);
    expect(await invoke('office.sheet.rows.patch', patch)).toMatchObject({
      ok: true,
      result: {
        data: {
          rows: [
            { id: 'SROW-001', businessVersion: 2 },
            { id: 'SROW-005', businessVersion: 2 }
          ]
        }
      }
    });
    expect(container.textContent).toContain('12500');
    expect(await invoke('office.sheet.export.start', example('office.sheet.export.start'))).toMatchObject({
      ok: true,
      result: { data: { assetId: 'SHEETAST-001', rowCount: 2 } }
    });
    expect(repository.snapshot().sheetExports[0].content).toContain('"SROW-001","DEP-001"');
    const after = api.manual();
    if (!('sections' in after)) throw new Error('Expected manual index after workflow.');
    expect(after.revision).toBe(index.revision);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it('shares page controls with the same sheet service and displays import errors', async () => {
  const repository = new DemoRepository();
  const container = document.createElement('div');
  document.body.append(container);
  const route = resolveRoute('/scenes/O07');
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <O07SheetPage repository={repository} />
        </AppProviders>
      )
    );
    const click = async (label: string) => {
      const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
      if (!button) throw new Error(`Missing button: ${label}`);
      await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };
    const checkbox = container.querySelector<HTMLInputElement>('input[aria-label="选择 SROW-001"]');
    if (!checkbox) throw new Error('Row checkbox is missing.');
    await act(async () => checkbox.click());
    const amount = container.querySelector<HTMLInputElement>('#o07-patch-amount');
    if (!amount) throw new Error('Amount input is missing.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Input setter is missing.');
    await act(async () => {
      setter.call(amount, '14000');
      amount.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const patchStatus = container.querySelector<HTMLSelectElement>('#o07-patch-status');
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (!patchStatus || !selectSetter) throw new Error('Patch status is missing.');
    await act(async () => {
      selectSetter.call(patchStatus, 'confirmed');
      patchStatus.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click('保存所选行');
    expect(repository.snapshot().sheetRows.find((row) => row.id === 'SROW-001')).toMatchObject({
      amountCents: 14000,
      status: 'confirmed',
      businessVersion: 2
    });
    const importInput = container.querySelector<HTMLTextAreaElement>('#o07-import');
    const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!importInput || !textareaSetter) throw new Error('Import input is missing.');
    await act(async () => {
      textareaSetter.call(importInput, JSON.stringify([
        { departmentId: 'DEP-001', label: '虚构导入记录甲', amountCents: 5000, status: 'draft' },
        { departmentId: 'DEP-999', label: '', amountCents: -1, status: 'draft' }
      ]));
      importInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click('校验导入');
    expect(container.querySelector('[aria-label="导入校验结果"]')?.textContent).toContain('rowNumber');
    await click('导出当前筛选');
    expect(container.querySelector('a[download]')).not.toBeNull();
    expect(repository.snapshot().sheetExports[0].rowCount).toBe(5);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
