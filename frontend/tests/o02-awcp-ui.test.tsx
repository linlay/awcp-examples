import type { AwcpActionResponse, AwcpManualSection, JsonObject } from '@app/awcp';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import O02DirectoryPage from '../src/pc/pages/O02DirectoryPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

function render(repository: DemoRepository, container: HTMLDivElement) {
  const route = resolveRoute('/scenes/O02');
  const root = createRoot(container);
  return {
    root,
    element: (
      <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
        <O02DirectoryPage repository={repository} />
      </AppProviders>
    )
  };
}

it('discovers O02 actions through Core and replays directory, team and group workflows', async () => {
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
      'office.directory.query',
      'office.team.read',
      'office.team.replace',
      'office.group.read',
      'office.group.save'
    ];
    for (const action of actions) expect(index.sections.some((item) => item.section === action)).toBe(true);
    const example = (action: string): JsonObject => {
      const section = api.manual({ section: action, revision: index.revision }) as AwcpManualSection;
      const result = section.examples?.[0];
      if (!result) throw new Error(`Missing example: ${action}`);
      return result;
    };
    let count = 0;
    const invoke = async (action: string, args: JsonObject): Promise<AwcpActionResponse> => {
      let response: AwcpActionResponse | undefined;
      await act(async () => {
        response = await api.invoke({ action, args, requestId: `o02-awcp-${++count}`, revision: index.revision });
      });
      if (!response) throw new Error(`No response: ${action}`);
      return response;
    };
    expect(await invoke('office.directory.query', example('office.directory.query'))).toMatchObject({
      ok: true,
      result: {
        data: {
          employees: expect.arrayContaining([expect.objectContaining({ id: 'EMP-003', departmentId: 'DEP-002' })])
        }
      }
    });
    expect(
      await invoke('office.directory.query', { ...example('office.directory.query'), name: '不存在的人' })
    ).toMatchObject({ ok: true, result: { data: { employees: [] } } });
    const before = repository.snapshot();
    expect(
      await invoke('office.team.replace', {
        ...example('office.team.replace'),
        memberIds: ['EMP-012'],
        idempotencyKey: 'o02-inactive-awcp'
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid_arguments', details: { executionStarted: false } } });
    expect(repository.snapshot()).toEqual(before);
    expect(await invoke('office.team.replace', example('office.team.replace'))).toMatchObject({
      ok: true,
      result: { data: { id: 'TEAM-001', businessVersion: 2 } }
    });
    expect(await invoke('office.team.replace', example('office.team.replace'))).toMatchObject({
      ok: true,
      result: { data: { businessVersion: 2 } }
    });
    expect(await invoke('office.team.read', example('office.team.read'))).toMatchObject({
      ok: true,
      result: { data: { memberIds: ['EMP-003', 'EMP-004'], businessVersion: 2 } }
    });
    expect(await invoke('office.group.save', example('office.group.save'))).toMatchObject({
      ok: true,
      result: { data: { id: 'CGROUP-001', businessVersion: 2 } }
    });
    expect(await invoke('office.group.read', example('office.group.read'))).toMatchObject({
      ok: true,
      result: { data: { memberIds: ['EMP-003', 'EMP-004'] } }
    });
    expect(
      await invoke('office.group.save', { ...example('office.group.save'), idempotencyKey: 'o02-stale-awcp' })
    ).toMatchObject({ ok: false, error: { code: 'invalid_arguments', details: { executionStarted: false } } });
    expect(container.textContent).toContain('EMP-004 · 版本 2');
    const after = api.manual();
    if (!('sections' in after)) throw new Error('Expected manual index after operations.');
    expect(after.revision).toBe(index.revision);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it('uses the same directory service from page selections', async () => {
  const repository = new DemoRepository();
  const container = document.createElement('div');
  document.body.append(container);
  const { root, element } = render(repository, container);
  try {
    await act(async () => root.render(element));
    const toggle = async (id: string) => {
      const fieldset = container.querySelector('fieldset');
      const label = [...(fieldset?.querySelectorAll('label') ?? [])].find((item) => item.textContent?.includes(id));
      const checkbox = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (!checkbox) throw new Error(`Missing checkbox: ${id}`);
      await act(async () => checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };
    const click = async (name: string) => {
      const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === name);
      if (!button) throw new Error(`Missing button: ${name}`);
      await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };
    await toggle('EMP-009');
    await toggle('EMP-004');
    await click('替换协作人员');
    await click('保存通讯分组');
    expect(repository.snapshot().officeTeams[0].memberIds).toEqual(['EMP-003', 'EMP-004']);
    expect(repository.snapshot().contactGroups[0].memberIds).toEqual(['EMP-003', 'EMP-004']);
    expect(container.textContent).toContain('EMP-004 · 版本 2');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
