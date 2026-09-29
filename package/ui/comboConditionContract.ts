import dayjs from 'dayjs';

import {
  cloneJson,
  isJsonObject,
  type AwcpFieldError,
  type JsonObject,
  type JsonSchema,
  type JsonValue
} from '../awcp';

import type {
  ComboConditionControl,
  ComboConditionField,
  ComboConditionFunction,
  ComboConditionOperator
} from './types';

interface ReplaceConditionInput extends JsonObject {
  value: JsonObject;
}

interface ComboConditionAwcpOptions {
  fields: readonly ComboConditionField[];
  operators: readonly ComboConditionOperator[];
  functions?: readonly ComboConditionFunction[];
  controls: readonly ComboConditionControl[];
}

export interface ComboConditionAwcpContract {
  replaceInputSchema: JsonSchema;
  validateReplaceInput(args: ReplaceConditionInput): AwcpFieldError[];
  toUiCondition(value: unknown): JsonObject;
  fromUiCondition(value: unknown): JsonObject;
}

const CONDITION_REF = '#/$defs/condition';
const MAX_CONDITION_DEPTH = 20;
const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DATETIME_PATTERN = '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$';
const VALUE_FIELDS = {
  string: 'stringValue',
  number: 'numberValue',
  boolean: 'booleanValue',
  datetime: 'datetimeValue'
} as const;

export const COMBO_CONDITION_READ_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false
};

export function createComboConditionAwcpContract({
  fields,
  operators,
  functions = [],
  controls
}: ComboConditionAwcpOptions): ComboConditionAwcpContract {
  const fieldMap = new Map(fields.map((field) => [field.key, field]));
  const operatorMap = new Map(operators.map((operator) => [operator.key, operator]));
  const functionMap = new Map(functions.map((func) => [func.key, func]));
  const controlMap = new Map(controls.map((control) => [control.mask, control.type]));
  const allowedKeys = new Set(['join', 'nodes', 'field', 'oper', ...Object.values(VALUE_FIELDS)]);
  if (functionMap.size > 0) allowedKeys.add('func');
  const completeConditionSchema = createCompleteConditionSchema(
    [...fieldMap.values()],
    [...operatorMap.values()],
    [...functionMap.values()],
    controlMap
  );

  const valueType = (node: JsonObject) => {
    const field = fieldMap.get(asString(node.field));
    const func = functionMap.get(asString(node.func));
    const mask = func?.return_mask ?? field?.mask;
    return mask === undefined ? undefined : controlMap.get(mask);
  };
  const validCondition = (value: unknown): value is JsonObject =>
    isConditionNode(value, fieldMap, operatorMap, functionMap, controlMap, allowedKeys, 0);

  return {
    replaceInputSchema: createReplaceRootSchema(completeConditionSchema),
    validateReplaceInput: (args) => findSemanticError(args.value, valueType),
    toUiCondition: (value) => {
      if (!validCondition(value)) throw new TypeError('Invalid complete AWCP condition.');
      return mapCondition(value, (node) => {
        const type = valueType(node);
        if (!type) return node;
        const key = VALUE_FIELDS[type];
        const { [key]: comparison, ...rest } = node;
        return { ...rest, value: comparison };
      });
    },
    fromUiCondition: (value) =>
      mapCondition(value, (node) => {
        const { value: comparison, ...rest } = node;
        // Clearing an editor produces null/undefined; keep the draft without a comparison.
        if (comparison === undefined || comparison === null) return rest;
        const type = valueType(node);
        if (!type || !isTypedValue(comparison, type))
          throw new TypeError('The current condition value does not match its configured control type.');
        return { ...rest, [VALUE_FIELDS[type]]: cloneJson(comparison) };
      })
  };
}

function mapCondition(value: unknown, mapLeaf: (node: JsonObject) => JsonObject, depth = 0): JsonObject {
  if (!isJsonObject(value)) return {};
  if (depth > MAX_CONDITION_DEPTH) throw new TypeError('Condition tree exceeds the depth limit.');
  const node = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
  if (Array.isArray(node.nodes))
    return { ...node, nodes: node.nodes.map((child) => mapCondition(child, mapLeaf, depth + 1)) };
  return mapLeaf(node);
}

function createReplaceRootSchema(conditionSchema: JsonSchema): JsonSchema {
  return {
    type: 'object',
    required: ['value'],
    properties: {
      value: {
        type: 'object',
        description: '完整条件。只有根 value 可以是空对象，表示清空条件。',
        anyOf: [{ type: 'object', properties: {}, additionalProperties: false }, { $ref: CONDITION_REF }]
      }
    },
    additionalProperties: false,
    $defs: { condition: conditionSchema }
  };
}

function createCompleteConditionSchema(
  fields: readonly ComboConditionField[],
  operators: readonly ComboConditionOperator[],
  functions: readonly ComboConditionFunction[],
  controls: ReadonlyMap<number, ComboConditionControl['type']>
): JsonSchema {
  const group: JsonSchema = {
    type: 'object',
    properties: {
      join: { type: 'string', enum: ['and', 'or'] },
      nodes: {
        type: 'array',
        minItems: 1,
        items: { $ref: CONDITION_REF },
        description: '完整子条件数组；子节点不能是空对象或编辑草稿。'
      }
    },
    required: ['join', 'nodes'],
    additionalProperties: false
  };
  const leaves: JsonSchema[] = [];
  for (const field of fields) {
    const directType = controls.get(field.mask);
    if (directType) {
      const allowed = operators.filter((operator) => isMaskCompatible(field.mask, operator.allow_mask));
      if (allowed.length) leaves.push(createLeafSchema(field, allowed, directType));
    }
    for (const func of functions) {
      if (field.mask !== func.param_mask) continue;
      const type = controls.get(func.return_mask);
      if (!type) continue;
      const allowed = operators.filter((operator) => isMaskCompatible(func.return_mask, operator.allow_mask));
      if (allowed.length) leaves.push(createLeafSchema(field, allowed, type, func));
    }
  }
  return { type: 'object', anyOf: [group, ...leaves] };
}

function createLeafSchema(
  field: ComboConditionField,
  operators: readonly ComboConditionOperator[],
  type: ComboConditionControl['type'],
  func?: ComboConditionFunction
): JsonSchema {
  const valueKey = VALUE_FIELDS[type];
  const properties: JsonObject = {
    field: {
      type: 'string',
      enum: [field.key],
      description: `${field.name}的字段 key。`
    },
    oper: {
      type: 'string',
      enum: operators.map((operator) => operator.key),
      description: '该字段及函数返回类型支持的操作符 key。'
    },
    [valueKey]: {
      type: type === 'datetime' ? 'string' : type,
      ...(type === 'datetime' ? { pattern: DATETIME_PATTERN } : {}),
      description:
        type === 'datetime'
          ? `本地日期时间，格式 ${DATETIME_FORMAT}，不附加时区。`
          : !func && type === 'string' && (field.control === 'dict' || field.control === 'userPicker')
            ? '页面控件使用的字符串 ID。'
            : `${type} 类型比较值。`
    }
  };
  if (func) properties.func = { type: 'string', enum: [func.key], description: `${func.name}的函数 key。` };
  return {
    type: 'object',
    properties,
    required: ['field', 'oper', valueKey, ...(func ? ['func'] : [])],
    additionalProperties: false
  };
}

function isConditionNode(
  value: unknown,
  fields: ReadonlyMap<string, ComboConditionField>,
  operators: ReadonlyMap<string, ComboConditionOperator>,
  functions: ReadonlyMap<string, ComboConditionFunction>,
  controls: ReadonlyMap<number, ComboConditionControl['type']>,
  allowedKeys: ReadonlySet<string>,
  depth: number
): value is JsonObject {
  if (!isJsonObject(value) || depth > MAX_CONDITION_DEPTH) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return depth === 0;
  if (keys.some((key) => !allowedKeys.has(key))) return false;
  if ('join' in value || 'nodes' in value) {
    return (
      keys.every((key) => key === 'join' || key === 'nodes') &&
      (value.join === 'and' || value.join === 'or') &&
      Array.isArray(value.nodes) &&
      value.nodes.length > 0 &&
      value.nodes.every((node) => isConditionNode(node, fields, operators, functions, controls, allowedKeys, depth + 1))
    );
  }
  const field = fields.get(asString(value.field));
  const operator = operators.get(asString(value.oper));
  if (!field || !operator) return false;
  const func = value.func === undefined ? undefined : functions.get(asString(value.func));
  if (value.func !== undefined && (!func || field.mask !== func.param_mask)) return false;
  const effectiveMask = func?.return_mask ?? field.mask;
  if (!isMaskCompatible(effectiveMask, operator.allow_mask)) return false;
  const type = controls.get(effectiveMask);
  if (!type) return false;
  const valueKeys = Object.values(VALUE_FIELDS).filter((key) => key in value);
  return valueKeys.length === 1 && valueKeys[0] === VALUE_FIELDS[type] && isTypedValue(value[valueKeys[0]], type);
}

function asString(value: JsonValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function isMaskCompatible(valueMask: number, allowedMask: number): boolean {
  return (valueMask & allowedMask) !== 0;
}

function isTypedValue(value: unknown, type: ComboConditionControl['type']): boolean {
  if (type === 'datetime') {
    return (
      typeof value === 'string' &&
      new RegExp(DATETIME_PATTERN).test(value) &&
      dayjs(value).isValid() &&
      dayjs(value).format(DATETIME_FORMAT) === value
    );
  }
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function findSemanticError(
  value: JsonObject,
  valueType: (node: JsonObject) => ComboConditionControl['type'] | undefined,
  path: Array<string | number> = ['value'],
  depth = 0
): AwcpFieldError[] {
  if (depth > MAX_CONDITION_DEPTH) return [{ path, messages: [`条件层级不能超过 ${MAX_CONDITION_DEPTH} 层。`] }];
  if (Array.isArray(value.nodes)) {
    for (let index = 0; index < value.nodes.length; index += 1) {
      const child = value.nodes[index];
      if (!isJsonObject(child)) continue;
      const errors = findSemanticError(child, valueType, [...path, 'nodes', index], depth + 1);
      if (errors.length > 0) return errors;
    }
    return [];
  }
  const type = valueType(value);
  if (type !== 'datetime') return [];
  const key = VALUE_FIELDS.datetime;
  return isTypedValue(value[key], type)
    ? []
    : [{ path: [...path, key], messages: [`必须是有效的 ${DATETIME_FORMAT} 本地日期时间。`] }];
}
