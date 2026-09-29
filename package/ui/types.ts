export interface ComboConditionField {
  key: string;
  name: string;
  mask: number;
  control?: 'dict' | 'userPicker';
}

export interface ComboConditionOperator {
  key: string;
  name: string;
  allow_mask: number;
}

export interface ComboConditionFunction {
  key: string;
  name: string;
  param_mask: number;
  return_mask: number;
}

export interface ComboConditionControl {
  mask: number;
  type: 'string' | 'number' | 'boolean' | 'datetime';
}

export interface ComboConditionValue {
  join?: 'and' | 'or';
  nodes?: ComboConditionValue[];
  func?: string;
  field?: string;
  oper?: string;
  value?: string | number | boolean;
}

export interface ColumnProps {
  name: string;
  seqno: number;
  label?: string;
  isRowKey?: boolean;
  hidden?: boolean;
  display: { type: string };
  editor: { type: string };
}

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}
