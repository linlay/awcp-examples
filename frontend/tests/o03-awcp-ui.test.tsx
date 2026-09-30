import type { AwcpActionResponse, AwcpManualSection, JsonObject } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import O03NoticePage from '../src/pc/pages/O03NoticePage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

function render(repository: DemoRepository, container: HTMLDivElement) {
  const route = resolveRoute('/scenes/O03');
  const root = createRoot(container);
  return {
    root,
    element: (
      <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
        <O03NoticePage repository={repository} />
      </AppProviders>
    )
  };
}

it('discovers O03 through both Core manual levels and replays publish and reminder branches', async () => {
  const repository = new DemoRepository();
  const container = document.createElement('div');
  document.body.append(container);
  const { root, element } = render(repository, container);
  try {
    await act(async () => root.render(element));
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge is missing.');
    const index = api.manual();
    if (!('sections' in index)) throw new Error('Expected manual index.');
    const actions = [
      'office.notice.read',
      'office.notice.recipients.replace',
      'office.notice.publish',
      'office.notice.unread',
      'office.notice.remind'
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
        response = await api.invoke({ action, args, requestId: `o03-awcp-${++count}`, revision: index.revision });
      });
      if (!response) throw new Error(`No response: ${action}`);
      return response;
    };
    const initial = repository.snapshot();
    expect(
      await invoke('office.notice.recipients.replace', {
        ...example('office.notice.recipients.replace'),
        departmentIds: ['DEP-999'],
        idempotencyKey: 'o03-bad-dept-awcp'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid_arguments', details: { executionStarted: false } } });
    expect(repository.snapshot()).toEqual(initial);
    expect(await invoke('office.notice.publish', example('office.notice.publish'))).toMatchObject({
      ok: true,
      result: { data: { noticeId: 'NTC-001', status: 'published', businessVersion: 2 } }
    });
    expect(await invoke('office.notice.read', { ...example('office.notice.read'), noticeId: 'NTC-001' })).toMatchObject(
      {
        ok: true,
        result: {
          data: {
            publication: { recipientDepartmentIds: ['DEP-001'], recipientEmployeeIds: ['EMP-001', 'EMP-002'] },
            receipts: [
              expect.objectContaining({ employeeId: 'EMP-001' }),
              expect.objectContaining({ employeeId: 'EMP-002' })
            ]
          }
        }
      }
    );
    expect(await invoke('office.notice.unread', example('office.notice.unread'))).toMatchObject({
      ok: true,
      result: { data: { employeeIds: ['EMP-005', 'EMP-007'], receiptIds: ['NREC-002', 'NREC-003'] } }
    });
    expect(await invoke('office.notice.remind', example('office.notice.remind'))).toMatchObject({
      ok: true,
      result: { data: { status: 'published', businessVersion: 3 } }
    });
    expect(await invoke('office.notice.remind', example('office.notice.remind'))).toMatchObject({
      ok: true,
      result: { data: { businessVersion: 3 } }
    });
    expect(repository.snapshot().noticeReminders).toHaveLength(2);
    expect(
      await invoke('office.notice.remind', {
        ...example('office.notice.remind'),
        expectedVersion: 3,
        idempotencyKey: 'o03-second-reminder'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid_arguments', details: { executionStarted: false } } });
    expect(repository.snapshot().noticePublications).toHaveLength(2);
    const after = api.manual();
    if (!('sections' in after)) throw new Error('Expected manual index after workflow.');
    expect(after.revision).toBe(index.revision);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it('shares notice state between page controls and service', async () => {
  const repository = new DemoRepository();
  const container = document.createElement('div');
  document.body.append(container);
  const { root, element } = render(repository, container);
  try {
    await act(async () => root.render(element));
    const click = async (label: string) => {
      const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
      if (!button) throw new Error(`Missing button: ${label}`);
      await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };
    const toggle = async (departmentId: string) => {
      const fieldset = container.querySelector('fieldset');
      const label = [...(fieldset?.querySelectorAll('label') ?? [])].find((item) =>
        item.textContent?.includes(departmentId)
      );
      const checkbox = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (!checkbox) throw new Error(`Missing department: ${departmentId}`);
      await act(async () => checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };
    await toggle('DEP-001');
    await toggle('DEP-002');
    await click('保存接收部门');
    await click('模拟发布');
    expect(repository.snapshot().notices.find((item) => item.id === 'NTC-001')?.status).toBe('published');
    expect(
      repository.snapshot().noticePublications.find((item) => item.noticeId === 'NTC-001')?.recipientDepartmentIds
    ).toEqual(['DEP-002']);
    const select = container.querySelector<HTMLSelectElement>('#o03-notice');
    if (!select) throw new Error('Notice selector is missing.');
    await act(async () => {
      select.value = 'NTC-002';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click('模拟提醒');
    expect(repository.snapshot().noticeReminders.map((item) => item.employeeId)).toEqual(['EMP-005', 'EMP-007']);
    expect(container.textContent).toContain('模拟提醒 2 条');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
