import { type ReactElement } from 'react';
import { useAwcpAction, type AwcpActionRegistration, type AwcpFieldError, type JsonObject } from '../awcp';
import {
  DATA_TABLE_READ_SCHEMA,
  DATA_TABLE_SELECT_SCHEMA,
  DATA_TABLE_SINGLE_SELECT_SCHEMA,
  toAwcpRows
} from './dataTableContract';
import type { ColumnProps } from './types';

interface DataTableProps<T extends object> {
  columns: ColumnProps[];
  dataSource: T[];
  loading?: boolean;
  selectable?: boolean;
  multiple?: boolean;
  selectRows?: string[];
  editable?: boolean;
  copyable?: boolean;
  pasteable?: boolean;
  awcp?: { id: string; description: string; enabled?: boolean };
  onRowSelect?: (selection: {
    index: number;
    isChecked: boolean;
    row: T | null;
    keys: string | string[];
    data: T | T[] | null;
  }) => void;
}

export function DataTable<T extends object>({
  columns,
  dataSource,
  loading,
  selectable,
  multiple = false,
  selectRows = [],
  awcp,
  onRowSelect
}: DataTableProps<T>): ReactElement {
  const visibleColumns = columns.filter((column) => !column.hidden).sort((a, b) => a.seqno - b.seqno);
  const rowKey = columns.find((column) => column.isRowKey)?.name ?? columns[0]?.name ?? 'id';
  const keyFor = (row: T): string => String((row as Record<string, unknown>)[rowKey]);
  const enabled = Boolean(awcp && awcp.enabled !== false);
  const read: AwcpActionRegistration | null =
    enabled && awcp
      ? {
          action: `${awcp.id}.read`,
          title: `读取${awcp.description}`,
          description: [
            `用途：读取${awcp.description}当前可见列和行数据。`,
            '参数约定：不接收参数，传入空对象。',
            '执行效果：只读，不改变表格状态。',
            '返回结果：rows 为当前数据，只包含可见列。'
          ].join('\n'),
          inputSchema: DATA_TABLE_READ_SCHEMA,
          examples: [{}],
          invoke: async () => ({
            rows: toAwcpRows(
              dataSource,
              visibleColumns.map((column) => column.name)
            )
          })
        }
      : null;
  const select: AwcpActionRegistration | null =
    enabled && awcp && selectable
      ? {
          action: `${awcp.id}.select`,
          title: `选择${awcp.description}行`,
          description: [
            `用途：按行主键更新${awcp.description}的当前选择。`,
            '调用前提：表格已启用行选择。',
            `参数约定：rowKeys 为非空字符串数组${multiple ? '，不可重复' : '，最多一个元素'}；空数组清空选择。`,
            '执行效果：替换当前选择并触发行选择回调。',
            '返回结果：rowKeys 为最终选择的行主键。',
            '失败处理：任一行主键不存在时不修改当前选择。'
          ].join('\n'),
          inputSchema: multiple ? DATA_TABLE_SELECT_SCHEMA : DATA_TABLE_SINGLE_SELECT_SCHEMA,
          examples: [{ rowKeys: [] }],
          validate: (args): AwcpFieldError[] =>
            (args.rowKeys as string[]).flatMap((key, index) =>
              dataSource.some((row) => keyFor(row) === key)
                ? []
                : [{ path: ['rowKeys', index], messages: ['对应的表格行不存在。'] }]
            ),
          invoke: async (args: JsonObject) => {
            const keys = args.rowKeys as string[];
            const selected = keys.map((key) => dataSource.find((row) => keyFor(row) === key));
            if (selected.some((row) => row === undefined)) throw new Error('DataTable row does not exist.');
            const resolved = selected.filter((row): row is T => row !== undefined);
            const last = resolved.at(-1);
            onRowSelect?.(
              last
                ? {
                    index: dataSource.indexOf(last),
                    isChecked: true,
                    row: last,
                    keys: multiple ? keys : keys[0],
                    data: multiple ? resolved : last
                  }
                : { index: -1, isChecked: false, row: null, keys: [], data: null }
            );
            return { rowKeys: keys };
          }
        }
      : null;
  useAwcpAction(read);
  useAwcpAction(select);

  return (
    <div aria-label="演示单据列表" style={{ overflowX: 'auto' }}>
      {loading && <p>加载中…</p>}
      <table>
        <thead>
          <tr>
            {selectable && <th>选择</th>}
            {visibleColumns.map((column) => (
              <th key={column.name}>{column.label ?? column.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.map((row) => {
            const key = keyFor(row);
            return (
              <tr key={key}>
                {selectable && (
                  <td>
                    <input
                      type={multiple ? 'checkbox' : 'radio'}
                      name="form-table-selection"
                      checked={selectRows.includes(key)}
                      aria-label={`选择 ${key}`}
                      onChange={() =>
                        onRowSelect?.({
                          index: dataSource.indexOf(row),
                          isChecked: true,
                          row,
                          keys: multiple ? [key] : key,
                          data: row
                        })
                      }
                    />
                  </td>
                )}
                {visibleColumns.map((column) => (
                  <td key={column.name}>{String((row as Record<string, unknown>)[column.name] ?? '')}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
