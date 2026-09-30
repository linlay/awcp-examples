import { usePreferences } from '../../common/preferences/context';
import { Dropdown, Modal } from 'antd';
import { useState, type ReactElement } from 'react';
import { useDemoSession } from '../hooks/useDemoSession';
import styles from './AppShell.module.css';

export function SessionMenu(): ReactElement {
  const { t, locale } = usePreferences();
  const demo = useDemoSession();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function reset(): Promise<void> {
    if (!demo || busy) return;
    setBusy(true);
    setError('');
    try { await demo.reset(); setConfirming(false); }
    catch (error) { setError(error instanceof Error ? error.message : t("重置失败，请重试。")); }
    finally { setBusy(false); }
  }
  return <>
    <Dropdown trigger={['click']} menu={{ items: [
      { key: 'identity', label: t("演示人员在各业务页面中选择"), disabled: true },
      { key: 'dataset', label: demo ? (locale === 'zh-CN' ? `数据集 ${demo.session.datasetVersion} · ${demo.session.recordCount.toLocaleString(locale)} 条历史样本` : `Dataset ${demo.session.datasetVersion} · ${demo.session.recordCount.toLocaleString(locale)} historical records`) : t("演示服务未连接"), disabled: true },
      { type: 'divider' },
      { key: 'reset', label: t("重置当前演示数据"), danger: true, disabled: !demo }
    ], onClick: ({ key }) => { if (key === 'reset') { setError(''); setConfirming(true); } } }}>
      <button type="button" className={styles.userBadge} aria-label={t("打开演示账户菜单")} aria-haspopup="menu">
        <span className={styles.userAvatar} aria-hidden="true">{t("演")}</span>
        <span>{t("演示账户 ▾")}</span>
      </button>
    </Dropdown>
    <Modal title={t("重置当前演示数据？")} open={confirming} okText={t("恢复初始数据")} cancelText={t("取消")}
      confirmLoading={busy} okButtonProps={{ danger: true }} onOk={() => void reset()}
      onCancel={() => { if (!busy) setConfirming(false); }}>
      <p>{t("当前会话的办理记录、表单草稿和分析条件将回到初始状态，随后返回工作台，可以重新办理。")}</p>
      <p>{t("不会影响其他访问者的演示数据。")}</p>
      {error && <p role="alert">{error}</p>}
    </Modal>
  </>;
}
