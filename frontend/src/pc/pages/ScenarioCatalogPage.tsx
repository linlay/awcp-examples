import { usePreferences } from '../../common/preferences/context';
import {
  AlertOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  DashboardOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useRef, useState, type ReactElement } from 'react';

import { SCENARIOS, SCENARIO_GROUPS } from '../../common/scenarios/catalog';
import { AppLink } from '../components/AppShell';
import styles from './ScenarioCatalogPage.module.css';

interface ScenarioCatalogPageProps {
  navigate(path: string): void;
}

interface CoreShowcaseItem {
  id: string;
  title: string;
  path: string;
  desc: string;
  badge: string;
  icon: ReactElement;
}

const CORE_SHOWCASE: CoreShowcaseItem[] = [
  {
    id: 'O01',
    title: '工作台与待办事项',
    path: '/scenes/O01',
    desc: '面向前中后台人员的日常协同中心，聚合高优待办、超时催办与 AI 工作简报。',
    badge: '高频入口',
    icon: <DashboardOutlined />
  },
  {
    id: 'O08',
    title: '通用协同审批中心',
    path: '/scenes/O08',
    desc: '覆盖差旅报销、办公采购及合同审核的完整审批流转，支持意见批注与撤回补正。',
    badge: '流程流转',
    icon: <AuditOutlined />
  },
  {
    id: 'S01',
    title: '客户审核与适当性匹配',
    path: '/scenes/S01',
    desc: '证券投资者 KYC、风险承受能力评估，与金融产品风险等级的自动化适当性双向匹配。',
    badge: '核心业务',
    icon: <UserOutlined />
  },
  {
    id: 'S02',
    title: '研报编制与发布审阅',
    path: '/scenes/S02',
    desc: '证券研究所核心业务，支持分析师观点草拟、合规引用检查、专家质审到正式发布。',
    badge: '内容生产',
    icon: <FileTextOutlined />
  },
  {
    id: 'S04',
    title: '风险预警调查与处置',
    path: '/scenes/S04',
    desc: '证券风控合规实时告警中枢，覆盖异常交易监测、证据链核验、调查结论与归档闭环。',
    badge: '风险监控',
    icon: <AlertOutlined />
  }
];

const DEMO_TASKS = [
  '打开 S01 的 CLI-002，补全客户资料、评估风险等级，并说明是否可以匹配 PRD-001。',
  '查看 S04 的风险预警，核对关联客户或投行项目，再说明处置进度。',
  '在 O03 起草一条客户交流会议通知，标题和正文由我提供，保存后打开详情。'
];

interface CopyFeedback {
  index: number;
  message: string;
}

export default function ScenarioCatalogPage({ navigate }: ScenarioCatalogPageProps): ReactElement {
  const { t } = usePreferences();
  const taskTextRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);

  const copyTask = async (task: string, index: number): Promise<void> => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(task);
      setCopyFeedback({ index, message: t("已复制") });
      return;
    } catch {
      // Some desktop browsers deny the async clipboard API even after a click.
    }

    const textElement = taskTextRefs.current[index];
    const selection = window.getSelection();
    if (!textElement || !selection) {
      setCopyFeedback({ index, message: '无法自动复制，请手动选中文字后按 ⌘C 或 Ctrl+C。' });
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(textElement);
    selection.removeAllRanges();
    selection.addRange(range);

    try {
      if (document.execCommand('copy')) {
        selection.removeAllRanges();
        setCopyFeedback({ index, message: t("已复制") });
        return;
      }
    } catch {
      // Keep the task text selected so the user can copy it manually.
    }

    setCopyFeedback({ index, message: '无法自动复制，文字已选中，请按 ⌘C 或 Ctrl+C。' });
  };

  return (
    <div className={styles.catalogContainer}>
      {/* Hero Header */}
      <section className={styles.hero}>
        <div className={styles.heroTag}>
          <SafetyCertificateOutlined /> {t("星澜协同 · AWCP 业务示范平台")}</div>
        <h1 className={styles.heading}>{t("场景目录与协同工作站")}</h1>
        <p className={styles.intro}>
          {t('面向内部协议实验与对外业务 PoC，展示模型如何按用户任务进入业务场景、填写表单并办理事项。系统使用虚构记录和现有 AWCP Action，演示跨页面的业务流转与结果核对。')}
        </p>

        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{t("5 大核心")}</div>
            <div className={styles.statLabel}>{t("重点示范业务中心")}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{t("31 个")}</div>
            <div className={styles.statLabel}>{t("全量协议与业务覆盖场景")}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>S01～S05</div>
            <div className={styles.statLabel}>{t("业务办理样例")}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{t("按需办理")}</div>
            <div className={styles.statLabel}>{t("自然语言任务驱动")}</div>
          </div>
        </div>
      </section>

      <section aria-label={t("自然语言演示任务")} className={styles.taskExamples}>
        <h2>{t("可复制的演示任务")}</h2>
        <p>{t("这些只是提问示例，不会自动运行。模型根据实际任务进入相应页面并操作。")}</p>
        {DEMO_TASKS.map((task, index) => (
          <div key={t(task)} className={styles.taskExample}>
            <span
              ref={(element) => {
                taskTextRefs.current[index] = element;
              }}
            >
              {t(task)}
            </span>
            <button type="button" onClick={() => void copyTask(t(task), index)}>
              {t("复制")}</button>
            {copyFeedback?.index === index && (
              <span role="status" className={styles.copyStatus}>
                {t(copyFeedback.message)}
              </span>
            )}
          </div>
        ))}
      </section>

      {/* Featured Core Showcase */}
      <section>
        <div className={styles.sectionTitle}>
          <div className={styles.sectionHeading}>{t("核心业务展示中心")}</div>
        </div>
        <div className={styles.featuredGrid}>
          {CORE_SHOWCASE.map((item) => (
            <div key={item.id} className={styles.featuredCard}>
              <div>
                <div className={styles.featuredCardHeader}>
                  <div className={styles.featuredIconWrapper}>{item.icon}</div>
                  <span className={styles.featuredBadge}>{t(item.badge)}</span>
                </div>
                <div className={styles.featuredTitle}>{t(item.title)}</div>
                <div className={styles.featuredDesc}>{t(item.desc)}</div>
              </div>
              <div className={styles.featuredMeta}>
                <span className={styles.featuredId}>{item.id}</span>
                <button type="button" onClick={() => navigate(item.path)} className={styles.featuredAction}>
                  {t("进入业务")}<ArrowRightOutlined />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Full 31 Scenarios Catalog */}
      <section>
        <div className={styles.sectionTitle}>
          <div className={styles.sectionHeading}>{t('全量场景目录（共 31 场景）')}</div>
        </div>

        {SCENARIO_GROUPS.map((group) => (
          <div key={group.id} aria-labelledby={`group-${group.id}`} className={styles.group}>
            <h2 id={`group-${group.id}`} className={styles.groupHeading}>
              {t(group.title)}
            </h2>
            <ul className={styles.grid}>
              {SCENARIOS.filter((scenario) => scenario.group === group.id).map((scenario) => (
                <li key={scenario.id} className={styles.card}>
                  <AppLink href={scenario.path} navigate={navigate} className={styles.cardLink}>
                    <span className={styles.id}>{scenario.id}</span>
                    <span className={styles.title}>{t(scenario.title)}</span>
                    <span className={styles.path}>{scenario.path}</span>
                  </AppLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
