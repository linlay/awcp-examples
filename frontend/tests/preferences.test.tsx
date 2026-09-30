import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../src/common/preferences/Preferences';
import { usePreferences } from '../src/common/preferences/context';

function Probe() {
  const { t, setMode, setLocale } = usePreferences();
  const [draft, setDraft] = useState('');
  return (
    <>
      <p>{t('审批中心')}</p>
      <button onClick={() => setDraft('unsaved form')}>draft</button>
      <output>{draft}</output>
      <button
        onClick={() => {
          setMode('light');
          setLocale('en-US');
        }}
      >
        switch
      </button>
    </>
  );
}
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.theme;
});
it('switches theme and locale without remounting forms and restores preferences after reload', async () => {
  localStorage.clear();
  const container = document.createElement('div');
  let root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <PreferencesProvider>
          <Probe />
        </PreferencesProvider>
      )
    );
    await act(async () => container.querySelectorAll('button')[0].click());
    await act(async () => container.querySelectorAll('button')[1].click());
    expect(container.textContent).toContain('Approval center');
    expect(container.querySelector('output')?.textContent).toBe('unsaved form');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.lang).toBe('en-US');
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () =>
      root.render(
        <PreferencesProvider>
          <Probe />
        </PreferencesProvider>
      )
    );
    expect(container.textContent).toContain('Approval center');
    expect(document.documentElement.dataset.theme).toBe('light');
  } finally {
    await act(async () => root.unmount());
  }
});
it('uses defaults when saved preferences are corrupt and tolerates unavailable storage', async () => {
  localStorage.setItem('awcp.preferences.v1', '{broken');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <PreferencesProvider>
          <Probe />
        </PreferencesProvider>
      )
    );
    expect(container.textContent).toContain('审批中心');
    await act(async () => container.querySelectorAll('button')[1].click());
    expect(container.textContent).toContain('Approval center');
  } finally {
    await act(async () => root.unmount());
  }
});
