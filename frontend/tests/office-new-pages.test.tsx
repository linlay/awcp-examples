import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { AppProviders } from '../src/app/AppProviders';
import { siteForRoute } from '../src/common/awcp/site';
import { DemoRepository } from '../src/common/store/repository';
import OfficeNewPage from '../src/pc/pages/OfficeNewPage';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

const cases = [
  ['O04', 'discussion', 'office.discussion.create'],
  ['O05', 'meeting', 'office.meeting.reserve'],
  ['O12', 'contract', 'office.contract.register'],
  ['O13', 'reservation', 'office.resource.reserve'],
  ['O14', 'project', 'office.project.create'],
  ['O15', 'access', 'office.access.request'],
  ['O16', 'report', 'office.report.generate']
] as const;

it.each(cases)('%s has a blank, page-scoped %s form', async (scenarioId, formType, action) => {
  const repository = new DemoRepository();
  const route = resolveRoute(`/scenes/${scenarioId}/new/${formType}`);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(
      <AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}>
        <OfficeNewPage repository={repository} scenarioId={scenarioId} />
      </AppProviders>
    ));
    const manual = window.awcp?.manual();
    if (!manual || !('sections' in manual)) throw new Error('AWCP manual missing.');
    expect(manual.sections.map((section) => section.section)).toContain(action);
    expect([...container.querySelectorAll('input:not([type="checkbox"]), textarea, select')].every((field) => (field as HTMLInputElement).value === '')).toBe(true);
    expect([...container.querySelectorAll('input[type="checkbox"]')].every((field) => !(field as HTMLInputElement).checked)).toBe(true);
    expect([...container.querySelectorAll('button')].find((button) => button.textContent === '提交')?.disabled).toBe(true);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
