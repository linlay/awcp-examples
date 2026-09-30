import { ConfigProvider, theme as antdTheme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useEffect, useMemo, useState, type PropsWithChildren, type ReactElement } from 'react';

import { defaults, PreferencesContext, translate, type Preferences, type Locale, type ColorMode } from './context';
const STORAGE_KEY = 'awcp.preferences.v1';
function readPreferences(): Preferences {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (stored && typeof stored === 'object') {
      const value = stored as Partial<Preferences>;
      return {
        locale: value.locale === 'en-US' ? 'en-US' : defaults.locale,
        mode: value.mode === 'light' ? 'light' : defaults.mode
      };
    }
  } catch {
    /* Preferences remain usable when storage is unavailable. */
  }
  return defaults;
}

export function PreferencesProvider({ children }: PropsWithChildren): ReactElement {
  const [preferences, setPreferences] = useState(readPreferences);
  const { locale, mode } = preferences;
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.lang = locale;
    document.documentElement.style.colorScheme = mode;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      /* Session-only preference. */
    }
  }, [preferences, locale, mode]);
  const value = useMemo(
    () => ({
      locale,
      mode,
      setLocale: (next: Locale) => setPreferences((current) => ({ ...current, locale: next })),
      setMode: (next: ColorMode) => setPreferences((current) => ({ ...current, mode: next })),
      t: (text: string) => translate(locale, text)
    }),
    [locale, mode]
  );
  return (
    <PreferencesContext.Provider value={value}>
      <ConfigProvider
        locale={locale === 'zh-CN' ? zhCN : enUS}
        theme={{
          algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: { colorPrimary: '#2563eb', borderRadius: 6 }
        }}
      >
        {children}
      </ConfigProvider>
    </PreferencesContext.Provider>
  );
}
