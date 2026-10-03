import { useId, useState } from 'react';
import type { DemoApi, ReportFilter, ReportResult } from '@app/api';
import { usePreferences } from '../../common/preferences/context';
import { useReportCharts } from '../hooks/useReportCharts';
import styles from './AnalysisCharts.module.css';

interface Props {
  api: DemoApi;
  result: ReportResult;
  disabled: boolean;
  label(key: string): string;
  drill(key: string, groupBy: ReportFilter['groupBy']): void;
}
const colors = ['#3b82f6', '#10b981', '#f59e0b', '#a78bfa', '#f43f5e'];
export function AnalysisCharts({ api, result, disabled, label, drill }: Props) {
  const { t, locale } = usePreferences();
  const { data, loading, error, retry } = useReportCharts(api, result.filter, result.generation, result.revision);
  const [metric, setMetric] = useState<'count' | 'amount'>('count');
  const gradient = useId().replace(/:/g, '');
  if (loading)
    return (
      <div className={styles.placeholder} role="status">
        {t('正在加载图表…')}
      </div>
    );
  if (error)
    return (
      <div className={styles.placeholder} role="alert">
        <p>{t('图表加载失败，请重试。')}</p>
        <button type="button" onClick={retry}>
          {t('重试')}
        </button>
      </div>
    );
  if (!data || !result.summary.count) return <div className={styles.placeholder}>{t('当前条件没有匹配的样本。')}</div>;
  const ordered = [...data.month].sort((a, b) => a.key.localeCompare(b.key));
  const monthly: ReportResult['groups'] = [];
  if (ordered.length) {
    const last = ordered[ordered.length - 1].key;
    let month = ordered[0].key;
    while (month <= last) {
      monthly.push(
        ordered.find((row) => row.key === month) ?? {
          key: month,
          count: 0,
          amountCents: 0,
          approved: 0,
          overdue: 0,
          averageHours: null
        }
      );
      const [year, number] = month.split('-').map(Number);
      month = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
    }
  }
  const value = (row: ReportResult['groups'][number]) => (metric === 'count' ? row.count : row.amountCents / 100);
  const max = Math.max(1, ...monthly.map(value));
  const points = monthly.map((row, index) => ({
    row,
    x: monthly.length === 1 ? 360 : 64 + (index / (monthly.length - 1)) * 616,
    y: 190 - (value(row) / max) * 150
  }));
  const path = points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ');
  const total = data.status.reduce((sum, row) => sum + row.count, 0);
  let offset = 0;
  const ranked = [...data.department].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, 6);
  const rankMax = Math.max(1, ...ranked.map((row) => row.count));
  const businessMax = Math.max(1, ...data.scenario.map((row) => row.count));
  const number = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: metric === 'amount' ? 2 : 0 });
  return (
    <section className={styles.charts} aria-label={t('分析图表')} aria-busy={disabled}>
      <article className={`${styles.card} ${styles.trend}`}>
        <header>
          <div>
            <h2>{t('月度业务趋势')}</h2>
            <p>{t('点击月份，查看该月明细。')}</p>
          </div>
          <div className={styles.segment} aria-label={t('趋势指标')}>
            <button type="button" aria-pressed={metric === 'count'} onClick={() => setMetric('count')}>
              {t('业务量')}
            </button>
            <button type="button" aria-pressed={metric === 'amount'} onClick={() => setMetric('amount')}>
              {t('金额（元）')}
            </button>
          </div>
        </header>
        <div className={styles.trendScroll}>
          <svg viewBox="0 0 720 230" className={styles.lineChart} role="group" aria-label={t('月度业务趋势')}>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity=".24" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity=".01" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((ratio) => (
              <g key={ratio}>
                <line x1="64" x2="680" y1={190 - ratio * 150} y2={190 - ratio * 150} className={styles.gridLine} />
                <text x="54" y={194 - ratio * 150} textAnchor="end" className={styles.axis}>
                  {Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(max * ratio)}
                </text>
              </g>
            ))}
            {points.length > 1 && <path d={`${path} L680,190 L64,190 Z`} fill={`url(#${gradient})`} />}
            <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" />
            {points.map(({ row, x, y }, index) => (
              <g key={row.key}>
                <circle cx={x} cy={y} r="5" fill="var(--color-bg-surface)" stroke="#3b82f6" strokeWidth="2" />
                <circle
                  cx={x}
                  cy={y}
                  r="12"
                  fill="transparent"
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled}
                  aria-label={`${row.key}: ${number(value(row))}`}
                  onClick={() => {
                    if (!disabled) drill(row.key, 'month');
                  }}
                  onKeyDown={(e) => {
                    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      drill(row.key, 'month');
                    }
                  }}
                >
                  <title>
                    {row.key}: {number(value(row))}
                  </title>
                </circle>
                {(index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0) && (
                  <text x={x} y="218" textAnchor="middle" className={styles.axis}>
                    {row.key}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
        <details className={styles.dataTable}>
          <summary>{t('查看图表数据')}</summary>
          <table>
            <thead>
              <tr>
                <th>{t('日期')}</th>
                <th>{t('业务量')}</th>
                <th>{t('金额（元）')}</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row) => (
                <tr key={row.key}>
                  <td>
                    <button type="button" disabled={disabled} onClick={() => drill(row.key, 'month')}>
                      {row.key}
                    </button>
                  </td>
                  <td>{row.count.toLocaleString(locale)}</td>
                  <td>{(row.amountCents / 100).toLocaleString(locale, { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </article>
      <article className={styles.card}>
        <header>
          <div>
            <h2>{t('办理状态占比')}</h2>
            <p>{t('当前筛选范围内的状态构成')}</p>
          </div>
        </header>
        <div className={styles.donutLayout}>
          <svg viewBox="0 0 160 160" role="img" aria-label={t('办理状态占比')} className={styles.donut}>
            <circle cx="80" cy="80" r="57" fill="none" stroke="var(--color-border-subtle)" strokeWidth="19" />
            {data.status.map((row, index) => {
              const percent = total ? (row.count / total) * 100 : 0;
              const start = offset;
              offset += percent;
              return (
                <circle
                  key={row.key}
                  cx="80"
                  cy="80"
                  r="57"
                  pathLength="100"
                  fill="none"
                  stroke={colors[index % colors.length]}
                  strokeWidth="19"
                  strokeDasharray={`${percent} ${100 - percent}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 80 80)"
                >
                  <title>
                    {label(row.key)}: {row.count} ({percent.toFixed(1)}%)
                  </title>
                </circle>
              );
            })}
            <text x="80" y="80" textAnchor="middle" className={styles.total}>
              {total.toLocaleString(locale)}
            </text>
            <text x="80" y="100" textAnchor="middle" className={styles.axis}>
              {t('业务样本')}
            </text>
          </svg>
          <div className={styles.legend}>
            {data.status.map((row, index) => (
              <button type="button" disabled={disabled} key={row.key} onClick={() => drill(row.key, 'status')}>
                <span className={styles.dot} style={{ background: colors[index % colors.length] }} />
                <span>{label(row.key)}</span>
                <strong>{((row.count / total) * 100).toFixed(1)}%</strong>
                <small>{row.count.toLocaleString(locale)}</small>
              </button>
            ))}
          </div>
        </div>
      </article>
      <article className={styles.card}>
        <header>
          <div>
            <h2>{t('部门业务量排名')}</h2>
            <p>{t('按业务量展示前 6 个部门')}</p>
          </div>
        </header>
        <div className={styles.ranks}>
          {ranked.map((row, index) => (
            <button type="button" disabled={disabled} key={row.key} onClick={() => drill(row.key, 'department')}>
              <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.rankBody}>
                <span>
                  {label(row.key)}
                  <strong>{row.count.toLocaleString(locale)}</strong>
                </span>
                <span className={styles.track}>
                  <span style={{ width: `${(row.count / rankMax) * 100}%` }} />
                </span>
              </span>
            </button>
          ))}
        </div>
      </article>
      <article className={`${styles.card} ${styles.business}`}>
        <header>
          <div>
            <h2>{t('业务类型对比')}</h2>
            <p>{t('比较不同业务的样本量，点击柱形查看明细。')}</p>
          </div>
        </header>
        <div className={styles.columns}>
          {data.scenario.map((row, index) => (
            <button
              type="button"
              disabled={disabled}
              key={row.key}
              onClick={() => drill(row.key, 'scenario')}
              aria-label={`${label(row.key)}: ${row.count}`}
            >
              <span className={styles.columnSpace}>
                <span
                  className={styles.column}
                  style={{ height: `${(row.count / businessMax) * 100}%`, background: colors[index % colors.length] }}
                >
                  <strong>{row.count.toLocaleString(locale)}</strong>
                </span>
              </span>
              <span>{label(row.key)}</span>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}
