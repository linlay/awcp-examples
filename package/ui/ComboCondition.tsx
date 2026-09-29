import { useMemo, useRef, type CSSProperties, type ReactElement } from 'react';
import { useAwcpAction, type AwcpActionRegistration, type JsonObject } from '../awcp';
import { COMBO_CONDITION_READ_SCHEMA, createComboConditionAwcpContract } from './comboConditionContract';
import type {
  ComboConditionControl,
  ComboConditionField,
  ComboConditionFunction,
  ComboConditionOperator,
  ComboConditionValue
} from './types';

interface ComboConditionProps {
  value?: ComboConditionValue;
  functions?: ComboConditionFunction[];
  fields: ComboConditionField[];
  operators: ComboConditionOperator[];
  controls: ComboConditionControl[];
  onChange?: (value: ComboConditionValue) => void;
  className?: string;
  style?: CSSProperties;
  awcp?: { id: string; description: string; enabled?: boolean; replaceExample: JsonObject };
}

export function ComboCondition({
  value = {},
  functions,
  fields,
  operators,
  controls,
  onChange,
  className,
  style,
  awcp
}: ComboConditionProps): ReactElement {
  const current = useRef(value);
  current.current = value;
  const contract = useMemo(
    () => createComboConditionAwcpContract({ fields, operators, functions, controls }),
    [fields, operators, functions, controls]
  );
  const enabled = Boolean(awcp && awcp.enabled !== false);
  const read: AwcpActionRegistration | null =
    enabled && awcp
      ? {
          action: `${awcp.id}.read`,
          title: `读取${awcp.description}`,
          description: [
            `用途：读取${awcp.description}的当前结构化条件。`,
            '参数约定：不接收参数，传入空对象。',
            '执行效果：只读，不改变组件状态。',
            '返回结果：value 为当前条件；人工编辑中的未完成节点也可能返回。'
          ].join('\n'),
          inputSchema: COMBO_CONDITION_READ_SCHEMA,
          examples: [{}],
          invoke: async () => ({ value: contract.fromUiCondition(current.current) })
        }
      : null;
  const replace: AwcpActionRegistration | null =
    enabled && awcp
      ? {
          action: `${awcp.id}.replace`,
          title: `替换${awcp.description}`,
          description: [
            `用途：整体替换${awcp.description}。`,
            '调用前提：组件已挂载且可编辑。',
            '参数约定：value 使用 inputSchema 声明的字段、操作符、函数和值字段；根 value 为空对象时清空条件。',
            '执行效果：覆盖当前条件并触发与人工编辑相同的 onChange。',
            '返回结果：value 为替换后的完整条件。',
            '失败处理：参数不符合字段组合、值类型或日期语义时不修改组件。'
          ].join('\n'),
          inputSchema: contract.replaceInputSchema,
          examples: [awcp.replaceExample],
          validate: (args) => contract.validateReplaceInput(args as { value: JsonObject }),
          invoke: async (args) => {
            const next = contract.toUiCondition(args.value) as ComboConditionValue;
            current.current = next;
            onChange?.(next);
            return { value: contract.fromUiCondition(next) };
          }
        }
      : null;
  useAwcpAction(read);
  useAwcpAction(replace);

  return (
    <div className={className} style={style} aria-label="筛选条件">
      <select
        aria-label="筛选字段"
        value={value.field ?? ''}
        onChange={(event) => onChange?.({ ...value, field: event.target.value || undefined })}
      >
        <option value="">全部字段</option>
        {fields.map((field) => (
          <option key={field.key} value={field.key}>
            {field.name}
          </option>
        ))}
      </select>
      <select
        aria-label="筛选操作符"
        value={value.oper ?? ''}
        onChange={(event) => onChange?.({ ...value, oper: event.target.value || undefined })}
      >
        <option value="">选择操作符</option>
        {operators.map((operator) => (
          <option key={operator.key} value={operator.key}>
            {operator.name}
          </option>
        ))}
      </select>
      <input
        aria-label="筛选值"
        value={String(value.value ?? '')}
        onChange={(event) => onChange?.({ ...value, value: event.target.value })}
      />
      <button type="button" onClick={() => onChange?.({})}>
        清空
      </button>
    </div>
  );
}
