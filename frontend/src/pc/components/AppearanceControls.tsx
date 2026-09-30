import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { usePreferences, type Locale } from '../../common/preferences/context';
import styles from './AppShell.module.css';

export function AppearanceControls() {
  const { mode, locale, setMode, setLocale, t } = usePreferences();
  return (
    <div className={styles.preferences}>
      <button
        type="button"
        onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
        title={t(mode === 'dark' ? '切换白天模式' : '切换夜间模式')}
        aria-label={t(mode === 'dark' ? '切换白天模式' : '切换夜间模式')}
      >
        {mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
      </button>
      <select aria-label={t('界面语言')} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
        <option value="zh-CN">中文</option>
        <option value="en-US">English</option>
      </select>
    </div>
  );
}
