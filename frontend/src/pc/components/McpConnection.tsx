import { ApiOutlined, CopyOutlined, ExportOutlined } from '@ant-design/icons';
import { Button, Modal } from 'antd';
import { useRef, useState } from 'react';
import { usePreferences } from '../../common/preferences/context';
import { useDemoSession } from '../hooks/useDemoSession';
import { getMcpConnection } from '../service/mcpConnection';
import styles from './McpConnection.module.css';

export function McpConnection() {
  const { t } = usePreferences();
  const demo = useDemoSession();
  const connection = getMcpConnection(demo?.session);
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const address = useRef<HTMLInputElement>(null);

  const copyAddress = async () => {
    if (!connection) return;
    try {
      await navigator.clipboard.writeText(connection.serverUrl);
      setCopyStatus('地址已复制');
    } catch {
      address.current?.focus();
      address.current?.select();
      setCopyStatus('自动复制失败，请手动复制地址。');
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        onClick={() => {
          setCopyStatus('');
          setOpen(true);
        }}
      >
        <ApiOutlined /> {t('MCP 连接')}
      </button>
      <Modal title={t('MCP 连接')} open={open} onCancel={() => setOpen(false)} footer={null} width={620}>
        {connection ? (
          <div className={styles.content}>
            <div>
              <div className={styles.addressHeading}>
                <label htmlFor="mcp-server-url">{t('服务地址')}</label>
                <span>Streamable HTTP</span>
              </div>
              <div className={styles.addressRow}>
                <input
                  ref={address}
                  id="mcp-server-url"
                  value={connection.serverUrl}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button icon={<CopyOutlined />} onClick={() => void copyAddress()}>
                  {t('复制地址')}
                </Button>
              </div>
              <div role="status" className={styles.copyStatus}>
                {t(copyStatus)}
              </div>
            </div>
            <section className={styles.method} aria-labelledby="mcp-oauth-title">
              <h3 id="mcp-oauth-title">{t('方式一：OAuth 授权')}</h3>
              <p>{t('在支持 OAuth 的 MCP 客户端中添加以上地址，按提示打开登录页并确认授权。')}</p>
              <span className={styles.hint}>{t('支持动态客户端注册、授权码与 PKCE（S256）。')}</span>
            </section>
            <section className={styles.method} aria-labelledby="mcp-token-title">
              <h3 id="mcp-token-title">{t('方式二：手动配置 Token')}</h3>
              <p>{t('登录连接页获取 Access Token，在客户端中添加以下请求头。')}</p>
              <code className={styles.tokenHeader}>Authorization: Bearer &lt;Access Token&gt;</code>
              <div className={styles.tokenActions}>
                <Button
                  href={connection.connectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  icon={<ExportOutlined />}
                >
                  {t('登录并获取 Token')}
                </Button>
                <span className={styles.hint}>{t('Token 有效期 1 小时，过期后重新登录。')}</span>
              </div>
            </section>
            <details className={styles.discovery}>
              <summary>{t('OAuth 发现地址')}</summary>
              <a href={connection.resourceMetadataUrl} target="_blank" rel="noopener noreferrer">
                {t('受保护资源元数据')}
                <ExportOutlined />
              </a>
              <a href={connection.authorizationMetadataUrl} target="_blank" rel="noopener noreferrer">
                {t('授权服务器元数据')}
                <ExportOutlined />
              </a>
            </details>
          </div>
        ) : (
          <p className={styles.unavailable}>
            {t(
              demo?.session.mcpAvailable === false
                ? '当前服务未启用 MCP。'
                : '暂时无法获取 MCP 连接信息，请确认演示服务已连接。'
            )}
          </p>
        )}
      </Modal>
    </>
  );
}
