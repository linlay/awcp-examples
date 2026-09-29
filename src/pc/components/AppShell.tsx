import {
  AlertOutlined,
  AppstoreOutlined,
  AuditOutlined,
  DashboardOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RightOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { MouseEvent, PropsWithChildren, ReactElement, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { findScenario } from '../../common/scenarios/catalog';
import type { DemoRepository } from '../../common/store/repository';
import { useBrowserPath } from '../routes/useBrowserPath';
import styles from './AppShell.module.css';

export interface AppLinkProps {
  href: string;
  navigate(path: string): void;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function AppLink({ href, navigate, children, className, title }: AppLinkProps): ReactElement {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <a href={href} onClick={handleClick} className={className} title={title}>
      {children}
    </a>
  );
}

interface AppShellProps extends PropsWithChildren {
  navigate(path: string): void;
  repository: DemoRepository;
}

interface NavMenuItem {
  key: string;
  title: string;
  path: string;
  icon: ReactElement;
  badge?: string;
  group?: string;
}

export function AppShell({ children, navigate }: AppShellProps): ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useBrowserPath();

  const navItems: NavMenuItem[] = useMemo(
    () => [
      {
        key: 'catalog',
        title: '场景总览',
        path: '/',
        icon: <AppstoreOutlined />
      },
      {
        key: 'O01',
        title: '工作台',
        path: '/scenes/O01',
        icon: <DashboardOutlined />,
        badge: '常用'
      },
      {
        key: 'O08',
        title: '审批中心',
        path: '/scenes/O08',
        icon: <AuditOutlined />,
        group: '协同办公'
      },
      {
        key: 'S01',
        title: '客户与适当性',
        path: '/scenes/S01',
        icon: <UserOutlined />,
        badge: '核心',
        group: '证券业务'
      },
      {
        key: 'S02',
        title: '研报中心',
        path: '/scenes/S02',
        icon: <FileTextOutlined />,
        group: '证券业务'
      },
      {
        key: 'S04',
        title: '风险监控',
        path: '/scenes/S04',
        icon: <AlertOutlined />,
        badge: '风控',
        group: '证券业务'
      }
    ],
    []
  );

  // Derive breadcrumbs based on pathname
  const breadcrumbs = useMemo(() => {
    if (pathname === '/' || pathname === '') {
      return [{ title: '场景总览', path: '/' }];
    }
    const match = /^\/scenes\/([A-Z]\d{2})/.exec(pathname);
    if (!match) {
      return [{ title: '首页', path: '/' }, { title: '未知页面' }];
    }
    const scenarioId = match[1];
    const scenario = findScenario(scenarioId);
    const categoryTitle =
      scenario?.group === 'securities' ? '证券业务' : scenario?.group === 'office' ? '协同办公' : '协议实验';

    return [
      { title: '首页', path: '/' },
      { title: categoryTitle },
      { title: scenario ? `${scenario.id} ${scenario.title}` : scenarioId }
    ];
  }, [pathname]);

  return (
    <div className={styles.shell}>
      {/* Collapsible Enterprise Sidebar */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandLogo}>星</div>
          {!collapsed && (
            <div className={styles.brandInfo}>
              <span className={styles.brandTitle}>星澜证券</span>
              <span className={styles.brandSubtitle}>AWCP 业务协同平台</span>
            </div>
          )}
        </div>

        <nav className={styles.navContainer} aria-label="侧边栏主导航">
          {navItems.map((item, index) => {
            const isActive =
              item.path === '/'
                ? pathname === '/' || pathname === ''
                : pathname.startsWith(item.path);

            const showGroup =
              !collapsed &&
              item.group &&
              (index === 0 || navItems[index - 1].group !== item.group);

            return (
              <div key={item.key}>
                {showGroup && <div className={styles.navGroupTitle}>{item.group}</div>}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(item.path)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(item.path);
                    }
                  }}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  title={collapsed ? item.title : undefined}
                >
                  <span className={styles.navItemIcon}>{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span>{item.title}</span>
                      {item.badge && <span className={styles.navItemBadge}>{item.badge}</span>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className={styles.mainWrapper}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <nav aria-label="面包屑" className={styles.breadcrumb}>
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <span key={crumb.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {idx > 0 && <RightOutlined className={styles.breadcrumbSeparator} />}
                    {crumb.path && !isLast ? (
                      <AppLink href={crumb.path} navigate={navigate} className={styles.breadcrumbItem}>
                        {crumb.title}
                      </AppLink>
                    ) : (
                      <span className={isLast ? styles.breadcrumbCurrent : styles.breadcrumbItem}>
                        {crumb.title}
                      </span>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.statusIndicator}>
              <span className={styles.pulseDot} />
              <span>AWCP 协议就绪</span>
            </div>

            <div className={styles.userBadge}>
              <div className={styles.userAvatar}>申</div>
              <span>EMP-001 (业务经理)</span>
            </div>
          </div>
        </header>

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
