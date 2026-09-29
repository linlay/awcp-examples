import { AwcpActionError } from '@app/awcp';
import type { AwcpFieldError, JsonObject, JsonValue } from '@app/awcp';

export interface PageGuide {
  purpose: string;
  regions: string;
  flow: string;
  limits: string;
}

export interface ActionGuide {
  purpose: string;
  prerequisites: string;
  parameters: string;
  effects: string;
  result: string;
  failures: string;
}

export function describePage(guide: PageGuide): string {
  return [
    `页面用途：${requiredText(guide.purpose)}`,
    `区域说明：${requiredText(guide.regions)}`,
    `操作流程：${requiredText(guide.flow)}`,
    `页面限制：${requiredText(guide.limits)}`
  ].join('\n');
}

export function describeAction(guide: ActionGuide): string {
  return [
    `方法用途：${requiredText(guide.purpose)}`,
    `执行前提：${requiredText(guide.prerequisites)}`,
    `参数语义：${requiredText(guide.parameters)}`,
    `业务影响：${requiredText(guide.effects)}`,
    `结果说明：${requiredText(guide.result)}`,
    `失败处理：${requiredText(guide.failures)}`
  ].join('\n');
}

export function fieldError(path: AwcpFieldError['path'], message: string): AwcpFieldError {
  return { path: [...path], messages: [requiredText(message)] };
}

export function businessError(code: `action.${string}`, message: string, details?: JsonValue): AwcpActionError {
  return new AwcpActionError(code, requiredText(message), details);
}

export type CompletedResult<Data extends JsonObject> = JsonObject & {
  status: 'completed';
  data: Data;
};

export type AcceptedResult = JsonObject & {
  status: 'accepted';
  jobId: string;
};

export type BusinessResult<Data extends JsonObject> = CompletedResult<Data> | AcceptedResult;

export function completed<Data extends JsonObject>(data: Data): CompletedResult<Data> {
  return { status: 'completed', data };
}

export function accepted(jobId: string): AcceptedResult {
  return { status: 'accepted', jobId: requiredText(jobId) };
}

function requiredText(value: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('AWCP guide text must not be empty.');
  return value.trim();
}
