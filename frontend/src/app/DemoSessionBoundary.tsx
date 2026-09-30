import { usePreferences } from '../common/preferences/context';
import { DemoApi, type DemoSession } from '@app/api';
import { Fragment, useCallback, useEffect, useRef, useState, type PropsWithChildren, type ReactElement } from 'react';

import { DemoSessionContext } from './demoSessionContext';
import styles from './DemoSessionBoundary.module.css';

export function DemoSessionBoundary({ children }: PropsWithChildren): ReactElement {
  const { t } = usePreferences();
  const [api] = useState(() => new DemoApi());
  const [session, setSession] = useState<DemoSession>();
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState('');
  const mounted = useRef(false);
  const resetInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (resetInFlight.current) return;
    try {
      const next = await api.session();
      if (mounted.current && !resetInFlight.current) { setSession(next); setError(''); }
    } catch (error) {
      if (mounted.current && !resetInFlight.current) setError(error instanceof Error ? error.message : '无法连接演示服务。');
    }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

  const reset = useCallback(async () => {
    if (resetInFlight.current) return;
    resetInFlight.current = true;
    setResetting(true);
    setError('');
    try {
      const next = await api.reset();
      if (!mounted.current) return;
      window.history.replaceState(null, '', '/scenes/O01');
      window.dispatchEvent(new PopStateEvent('popstate'));
      setSession(next);
      setNotice("演示数据已恢复初始状态，可以重新办理。");
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : t("重置失败，请重试。"));
      throw error;
    } finally {
      resetInFlight.current = false;
      if (mounted.current) setResetting(false);
    }
  }, [api, t]);

  if (!session) return <main className={styles.screen}>
    <h1>{t("AWCP 演示工作台")}</h1>
    <p role={error ? 'alert' : 'status'}>{error || t("正在准备独立的演示数据…")}</p>
    {error && <button type="button" onClick={() => void refresh()}>{t("重新连接")}</button>}
  </main>;

  return <DemoSessionContext.Provider value={{ session, api, reset, refresh }}>
    {notice && <div className={styles.notice} role="status">{t(notice)}<button type="button" aria-label={t("关闭提示")} onClick={() => setNotice('')}>×</button></div>}
    {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => void refresh()}>{t("刷新会话")}</button></div>}
    {resetting ? <main className={styles.screen} role="status">{t("正在恢复初始数据，请稍候…")}</main> :
      <Fragment key={`${session.id}:${session.generation}`}>{children}</Fragment>}
  </DemoSessionContext.Provider>;
}
