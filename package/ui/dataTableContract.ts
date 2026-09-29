import { cloneJson, isJsonObject, type JsonObject, type JsonSchema } from '../awcp';

export interface SelectRowsInput extends JsonObject {
  rowKeys: string[];
}

export const DATA_TABLE_READ_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false
};

function createSelectRowsSchema(multiple: boolean): JsonSchema {
  return {
    type: 'object',
    required: ['rowKeys'],
    properties: {
      rowKeys: {
        type: 'array',
        ...(multiple ? {} : { maxItems: 1 }),
        uniqueItems: true,
        items: { type: 'string', minLength: 1 }
      }
    },
    additionalProperties: false
  };
}

export const DATA_TABLE_SELECT_SCHEMA: JsonSchema = createSelectRowsSchema(true);
export const DATA_TABLE_SINGLE_SELECT_SCHEMA: JsonSchema = createSelectRowsSchema(false);

export function toAwcpRows(rows: unknown[], columnNames: string[]): JsonObject[] {
  return rows.map((row) => {
    if (!isJsonObject(row)) throw new TypeError('DataTable row must be a JSON object.');
    return Object.fromEntries(
      columnNames.flatMap((name) => {
        const value = row[name];
        return value === undefined ? [] : [[name, cloneJson(value)]];
      })
    );
  });
}
