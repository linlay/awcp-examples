import type { ComponentType } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import type { AwcpActionResponse, AwcpManualSection } from '@app/awcp';
import { AppProviders } from '../src/app/AppProviders';
import { DemoRepository } from '../src/common/store/repository';
import { siteForRoute } from '../src/common/awcp/site';
import { resolveRoute, scopeKeyForRoute } from '../src/pc/routes/route';

export async function replayReadPage(scenario: string, Page: ComponentType<{ repository: DemoRepository }>, action: string) {
  const repository = new DemoRepository();
  const before = repository.snapshot();
  const previous = window.awcp;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const route = resolveRoute(`/scenes/${scenario}`);
  let success: AwcpActionResponse | undefined;
  let invalid: AwcpActionResponse | undefined;
  let visible: string | null = null;
  try {
    await act(async () => root.render(<AppProviders site={siteForRoute(route)} scopeKey={scopeKeyForRoute(route)}><Page repository={repository} /></AppProviders>));
    const api = window.awcp;
    if (!api) throw new Error('AWCP bridge missing');
    const index = api.manual();
    if (!('sections' in index) || !index.sections.some((section) => section.section === action)) throw new Error(`Action missing: ${action}`);
    const section = api.manual({ section: action, revision: index.revision }) as AwcpManualSection;
    const args = section.examples?.[0];
    if (!args) throw new Error(`Example missing: ${action}`);
    await act(async () => {
      success = await api.invoke({ action, args, requestId: `${scenario}-read`, revision: index.revision });
      invalid = await api.invoke({ action, args: { ...args, actorId: 'EMP-999' }, requestId: `${scenario}-invalid`, revision: index.revision });
    });
    visible = container.textContent;
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
  if (window.awcp !== previous) throw new Error('AWCP bridge was not restored on unmount');
  return { success, invalid, before, after: repository.snapshot(), visible };
}
