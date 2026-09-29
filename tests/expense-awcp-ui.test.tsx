import type { AwcpActionResponse, AwcpManualSection, JsonObject } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import B06WorkspacePage from '../src/pc/pages/B06WorkspacePage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

it('checks expense tickets through the real two-level manual and the shared UI service', async () => {
  const repository = new DemoRepository();
  const route = resolveRoute('/scenes/O09/new/expense');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () =>
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <B06WorkspacePage repository={repository} formType="expense" />
        </AppProviders>
      )
    );
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = api.manual();
    if (!('sections' in index)) throw new Error('Expected manual index.');
    expect(index.sections.some((item) => item.section === 'office.expense.check')).toBe(true);
    const section = api.manual({ section: 'office.expense.check', revision: index.revision }) as AwcpManualSection;
    const example = section.examples?.[0] as JsonObject | undefined;
    if (!example) throw new Error('Expected legal expense example.');
    expect(section.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
    const invoke = (args: JsonObject, requestId: string) =>
      api.invoke({
        action: 'office.expense.check',
        args,
        revision: index.revision,
        requestId
      });

    const initial = repository.snapshot();
    const mismatched = await invoke({ ...example, declaredTotalCents: 50001 }, 'expense-mismatch');
    expect(mismatched).toMatchObject({
      ok: false,
      error: {
        code: 'invalid_arguments',
        details: { executionStarted: false, fieldErrors: [expect.objectContaining({ path: ['declaredTotalCents'] })] }
      }
    });
    expect(repository.snapshot()).toEqual(initial);

    const receipts = example.receipts as JsonObject[];
    const duplicate = await invoke({ ...example, receipts: [receipts[0], receipts[0]] }, 'expense-duplicate');
    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: 'invalid_arguments', details: { executionStarted: false } }
    });
    if (duplicate.ok) throw new Error('Expected duplicate invoice to fail.');
    expect(duplicate.error.details).toMatchObject({
      fieldErrors: expect.arrayContaining([expect.objectContaining({ path: ['receipts', 1, 'invoiceNo'] })])
    });
    expect(repository.snapshot()).toEqual(initial);

    let result: AwcpActionResponse | undefined;
    await act(async () => {
      result = await invoke(example, 'expense-example-first');
    });
    expect(result).toMatchObject({
      ok: true,
      result: {
        status: 'completed',
        data: {
          expenseFormId: 'FORM-003',
          status: 'checked',
          businessVersion: 1,
          declaredTotalCents: 50000
        }
      }
    });
    expect(container.querySelector<HTMLInputElement>('#expense-invoice')?.value).toBe('');
    await act(async () => {
      result = await invoke(example, 'expense-example-replay');
    });
    expect(result).toMatchObject({ ok: true, result: { data: { expenseFormId: 'FORM-003' } } });
    expect(repository.snapshot().expenseClaims).toHaveLength(1);

    const choose = async (selector: string, value: string) => {
      const input = container.querySelector<HTMLSelectElement>(selector);
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (!input || !setter) throw new Error(`Missing selector ${selector}`);
      await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('change', { bubbles: true })); });
    };
    const fill = async (selector: string, value: string) => {
      const input = container.querySelector<HTMLInputElement>(selector);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!input || !setter) throw new Error(`Missing field ${selector}`);
      await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
    };
    await choose('#expense-travel', 'FORM-001');
    await choose('#expense-asset', 'AST-003');
    await fill('#expense-invoice', 'DEMO-TRAIN-001');
    await choose('#expense-category', 'transport');
    await fill('#expense-amount', '30000');
    await fill('#expense-total', '30000');
    expect(container.querySelector<HTMLInputElement>('#expense-invoice')?.value).toBe('DEMO-TRAIN-001');
    await act(async () => {
      container
        .querySelector<HTMLFormElement>('form[aria-label="校验费用明细"]')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    const state = repository.snapshot();
    expect(state.expenseClaims.map((claim) => claim.formId)).toEqual(['FORM-003', 'FORM-004']);
    expect(state.expenseClaims[1].receipts[0].assetId).toBe('AST-003');
    expect(state.expenseClaims[1].travelFormId).toBe('FORM-001');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
