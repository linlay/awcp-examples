import { createContext, useContext } from 'react';
import { english } from './messages';
export type Locale = 'zh-CN' | 'en-US';
export type ColorMode = 'light' | 'dark';
export type Preferences = { locale: Locale; mode: ColorMode };
export const defaults: Preferences = { locale: 'zh-CN', mode: 'dark' };
export function translate(locale: Locale, text: string): string {
  return locale === 'en-US' ? (english[text] ?? text) : text;
}
export const PreferencesContext = createContext({
  ...defaults,
  setLocale: (_locale: Locale): void => undefined,
  setMode: (_mode: ColorMode): void => undefined,
  t: (text: string): string => text
});
export const usePreferences = () => useContext(PreferencesContext);
