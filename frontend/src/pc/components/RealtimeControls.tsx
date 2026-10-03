import { useSyncExternalStore } from 'react';
import { useRealtime } from '../../app/realtimeContext';
import { usePreferences } from '../../common/preferences/context';
import type { RealtimeService, SyncMode } from '../service/realtimeService';
import styles from './RealtimeControls.module.css';

export function RealtimeControls() {
  const realtime = useRealtime();
  return realtime ? <Controls realtime={realtime} /> : null;
}
function Controls({ realtime }: { realtime: RealtimeService }) {
  const { t } = usePreferences();
  const state = useSyncExternalStore(realtime.subscribe, realtime.snapshot);
  return (
    <div className={styles.controls}>
      <label title={t('仅作用于本标签页')}>
        <span>{t('实时同步')}</span>
        <select
          aria-label={t('实时同步模式（仅本标签页）')}
          value={state.mode}
          onChange={(event) => realtime.setMode(event.target.value as SyncMode)}
        >
          <option value="off">{t('关闭')}</option>
          <option value="notify">{t('仅提醒')}</option>
          <option value="auto">{t('自动更新')}</option>
        </select>
      </label>
      {state.mode !== 'off' && (
        <span
          className={state.connected ? styles.connected : styles.disconnected}
          title={t(state.connected ? '实时连接正常' : '实时连接中断，正在重连')}
          aria-label={t(state.connected ? '实时连接正常' : '实时连接中断，正在重连')}
        >
          ●
        </span>
      )}
      {state.pending > 0 && (
        <button type="button" disabled={state.busy} onClick={() => void realtime.refresh()}>
          {t(state.error ? '重试更新' : '有新数据')}
        </button>
      )}
    </div>
  );
}
