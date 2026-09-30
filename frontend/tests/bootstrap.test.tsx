import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it } from 'vitest';

import { App } from '../src/app/App';

it('opens the scene catalog with an empty AWCP manual and restores the bridge on unmount', async () => {
  const previous = window.awcp;
  const previousUrl = window.location.href;
  const container = document.createElement('div');
  const root = createRoot(container);

  try {
    window.history.replaceState(null, '', '/');
    await act(async () => {
      root.render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    });
    await act(async () => {
      await import('../src/pc/pages/ScenarioCatalogPage');
    });

    const api = window.awcp;
    if (!api) throw new Error('AWCP browser bridge was not exposed.');
    expect(api.protocolVersion).toBe(1);
    const manual = api.manual();
    if (!('sections' in manual)) throw new Error('Expected an AWCP manual index.');
    expect(manual.sections).toEqual([]);
    expect(manual.revision).not.toBe('');
    expect(container.textContent).toContain('场景目录');
    expect(container.querySelectorAll('a[href^="/scenes/"]').length).toBe(31);
  } finally {
    await act(async () => root.unmount());
    window.history.replaceState(null, '', previousUrl);
  }

  expect(window.awcp).toBe(previous);
});
