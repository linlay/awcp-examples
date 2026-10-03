import { usePreferences } from '../../common/preferences/context';
import styles from './ListPagination.module.css';

export function ListPagination({
  total,
  page,
  pageSize = 20,
  onChange
}: {
  total: number;
  page: number;
  pageSize?: number;
  onChange(page: number): void;
}) {
  const { t, locale } = usePreferences();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className={styles.pagination} aria-label={t('列表分页')}>
      <span>
        {locale === 'zh-CN' ? `共 ${total} 条 · 每页 ${pageSize} 条` : `${total} records · ${pageSize} per page`}
      </span>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {t('上一页')}
      </button>
      <span aria-live="polite">
        {page} / {pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        {t('下一页')}
      </button>
    </nav>
  );
}
