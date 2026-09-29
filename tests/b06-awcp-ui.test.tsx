import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';
import type { AwcpActionResponse, JsonObject } from '@app/awcp';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import B06WorkspacePage from '../src/pc/pages/B06WorkspacePage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

function manualIndex() {
  const manual = window.awcp?.manual();
  if (!manual || !('sections' in manual)) throw new Error('Expected AWCP manual index.');
  return manual;
}

async function invoke(action: string, args: JsonObject, requestId: string) {
  const api = window.awcp;
  if (!api) throw new Error('AWCP browser bridge is missing.');
  return api.invoke({ action, args, revision: manualIndex().revision, requestId });
}

it('shares draft state between UI and AWCP while native table actions remain read/select', async () => {
  const repository = new DemoRepository();
  const route = resolveRoute('/scenes/O09');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () => {
      root.render(
        <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
          <B06WorkspacePage repository={repository} />
        </AppProviders>
      );
    });

    expect(
      manualIndex()
        .sections.map((section) => section.section)
        .sort()
    ).toEqual([
      'office.expense.correct',
      'office.expense.read',
      'office.expense.review',
      'office.expense.submit',
      'office.form-filter.read',
      'office.form-filter.replace',
      'office.form-table.read',
      'office.form-table.select',
      'office.travel-draft.save'
    ]);

    const table = await invoke('office.form-table.read', {}, 'b06-table-read');
    expect(table.ok).toBe(true);
    if (table.ok) {
      const payload = JSON.stringify(table.result);
      expect(payload).toContain('FORM-002');
      expect(payload).not.toContain('applicantId');
      expect(payload).not.toContain('createdAt');
    }

    let selected: AwcpActionResponse | undefined;
    await act(async () => {
      selected = await invoke('office.form-table.select', { rowKeys: ['FORM-001'] }, 'b06-table-select');
    });
    expect(selected?.ok).toBe(true);
    expect(container.textContent).toContain('申请草稿 FORM-002');

    let filtered: AwcpActionResponse | undefined;
    await act(async () => {
      filtered = await invoke(
        'office.form-filter.replace',
        { value: { field: 'status', oper: 'eq', stringValue: 'draft' } },
        'b06-filter-replace'
      );
    });
    expect(filtered?.ok).toBe(true);
    const filteredTable = await invoke('office.form-table.read', {}, 'b06-filtered-read');
    expect(filteredTable.ok).toBe(true);
    if (filteredTable.ok) {
      expect(JSON.stringify(filteredTable.result)).toContain('FORM-002');
      expect(JSON.stringify(filteredTable.result)).not.toContain('FORM-001');
    }

    const draft = repository.snapshot().forms.find((item) => item.id === 'FORM-002');
    if (!draft) throw new Error('Seed draft is missing.');
    let save: AwcpActionResponse | undefined;
    await act(async () => {
      save = await invoke(
        'office.travel-draft.save',
        {
          formId: draft.id,
          actorId: draft.applicantId,
          applicantId: draft.applicantId,
          departmentId: draft.departmentId,
          amountCents: draft.amountCents + 100,
          assetIds: ['AST-002'],
          expectedVersion: draft.businessVersion
        },
        'b06-draft-save'
      );
    });
    if (!save) throw new Error('Draft save did not return.');
    expect(save.ok).toBe(true);
    expect(repository.snapshot().attachments.find((item) => item.assetId === 'AST-002')?.ownerId).toBe('FORM-002');

    const amount = container.querySelector<HTMLInputElement>('#draft-amount');
    if (!amount) throw new Error('Draft amount input is missing.');
    expect(amount.value).toBe(String(draft.amountCents + 100));
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error('Input value setter is missing.');
      setter.call(amount, String(draft.amountCents + 200));
      amount.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector<HTMLFormElement>('form[aria-label="演示申请草稿"]')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(repository.snapshot().forms.find((item) => item.id === 'FORM-002')?.businessVersion).toBe(3);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
