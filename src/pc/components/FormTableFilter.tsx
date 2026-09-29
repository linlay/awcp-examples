import {
  ComboCondition,
  DataTable,
  type ColumnProps,
  type ComboConditionControl,
  type ComboConditionField,
  type ComboConditionOperator,
  type ComboConditionValue
} from '@app/ui';
import { useMemo, useState, type ReactElement } from 'react';

import type { FormTableRow } from '../service/draftFormService';
import styles from './FormTableFilter.module.css';

const FILTER_FIELDS: ComboConditionField[] = [
  { key: 'status', name: '状态', mask: 1 },
  { key: 'department', name: '部门', mask: 1 },
  { key: 'applicant', name: '申请人', mask: 1 }
];
const FILTER_OPERATORS: ComboConditionOperator[] = [
  { key: 'eq', name: '等于', allow_mask: 1 },
  { key: 'contains', name: '包含', allow_mask: 1 }
];
const FILTER_CONTROLS: ComboConditionControl[] = [{ mask: 1, type: 'string' }];

const COLUMNS: ColumnProps[] = [
  { name: 'id', seqno: 0, label: '单据 ID', isRowKey: true, display: { type: 'text' }, editor: { type: 'input' } },
  { name: 'status', seqno: 1, label: '状态', display: { type: 'text' }, editor: { type: 'input' } },
  { name: 'applicant', seqno: 2, label: '申请人', display: { type: 'text' }, editor: { type: 'input' } },
  { name: 'department', seqno: 3, label: '部门', display: { type: 'text' }, editor: { type: 'input' } },
  { name: 'amountCents', seqno: 4, label: '金额（分）', display: { type: 'text' }, editor: { type: 'input' } },
  { name: 'businessVersion', seqno: 5, label: '业务版本', display: { type: 'text' }, editor: { type: 'input' } }
];

interface FormTableFilterProps {
  rows: FormTableRow[];
  selectedFormId: string | null;
  onSelect(formId: string | null): void;
}

export function FormTableFilter({ rows, selectedFormId, onSelect }: FormTableFilterProps): ReactElement {
  const [condition, setCondition] = useState<ComboConditionValue>({});
  const visibleRows = useMemo(() => rows.filter((row) => matchesCondition(row, condition)), [rows, condition]);

  return (
    <section className={styles.section} aria-label="演示单据筛选与表格">
      <h2>单据筛选与列表</h2>
      <ComboCondition
        value={condition}
        fields={FILTER_FIELDS}
        operators={FILTER_OPERATORS}
        controls={FILTER_CONTROLS}
        onChange={setCondition}
        awcp={{ id: 'office.form-filter', description: '演示单据筛选条件', replaceExample: { value: {} } }}
      />
      <DataTable
        columns={COLUMNS}
        dataSource={visibleRows}
        loading={false}
        selectable
        multiple={false}
        selectRows={selectedFormId ? [selectedFormId] : []}
        editable={false}
        copyable={false}
        pasteable={false}
        awcp={{ id: 'office.form-table', description: '演示单据列表' }}
        onRowSelect={({ keys }) => {
          const key = Array.isArray(keys) ? keys[0] : keys;
          onSelect(typeof key === 'string' && visibleRows.some((row) => row.id === key) ? key : null);
        }}
      />
    </section>
  );
}

function matchesCondition(row: FormTableRow, condition: ComboConditionValue): boolean {
  if ('nodes' in condition && Array.isArray(condition.nodes)) {
    if (condition.nodes.length === 0) return true;
    return condition.join === 'or'
      ? condition.nodes.some((node) => matchesCondition(row, node))
      : condition.nodes.every((node) => matchesCondition(row, node));
  }
  if (!('field' in condition) || !condition.field || !condition.oper || condition.value === undefined) return true;
  if (!FILTER_FIELDS.some((field) => field.key === condition.field)) return false;
  const value = row[condition.field];
  if (typeof value !== 'string') return false;
  const target = String(condition.value);
  return condition.oper === 'eq' ? value === target : condition.oper === 'contains' ? value.includes(target) : false;
}
