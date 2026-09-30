import Ajv from 'ajv';
import type { AwcpFieldError } from '@app/awcp';
import { fieldError } from '../../common/awcp/contracts';
import { RISK_DOSSIER_SCHEMA, RISK_DRAFT_SCHEMA } from '../../common/awcp/riskDossierSchemas';
import { DEMO_MARKETS, type RiskDossier } from '../../common/risk/dossier';
import type { DemoState } from '../../common/fixtures/types';

const ajv = new Ajv({ allErrors: true });
const shape = ajv.compile(RISK_DOSSIER_SCHEMA);
const draftShape = ajv.compile(RISK_DRAFT_SCHEMA);
export const validDraftShape = (value: unknown): boolean => !!draftShape(value);
const dateValid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function dossierErrors(
  value: unknown,
  state: DemoState,
  final: boolean,
  conclusion = '',
  disposition = ''
): AwcpFieldError[] {
  if (!shape(value))
    return (shape.errors ?? []).map((error) => {
      const path: Array<string | number> = error.instancePath.split('/').filter(Boolean).map((part) => /^\d+$/.test(part) ? Number(part) : part);
      if (error.keyword === 'required') path.push(String(error.params.missingProperty));
      return fieldError(['dossier', ...path], '表单字段格式无效。');
    });
  const d = value as RiskDossier;
  const errors: AwcpFieldError[] = [];
  const error = (path: Array<string | number>, message: string) =>
    errors.push(fieldError(['dossier', ...path], message));
  for (const field of ['periodStart', 'periodEnd', 'contactOn'] as const)
    if (d[field] && !dateValid(d[field])) error([field], '日期无效。');
  if (d.periodStart && d.periodEnd && d.periodStart > d.periodEnd) error(['periodEnd'], '结束日期不能早于开始日期。');
  if (final) {
    if (!d.periodStart) error(['periodStart'], '请填写核查开始日期。');
    if (!d.periodEnd) error(['periodEnd'], '请填写核查结束日期。');
    if (!d.riskLevel) error(['riskLevel'], '请选择风险等级。');
    if (!d.methods.length) error(['methods'], '请至少选择一种核查方式。');
    if (!d.checks.length) error(['checks'], '请至少添加一条核查明细。');
    if (d.contactRequired || d.methods.includes('contact')) {
      if (!dateValid(d.contactOn)) error(['contactOn'], '请填写有效的联系日期。');
      if (!d.contactMethod) error(['contactMethod'], '请选择联系渠道。');
      if (!d.contactSummary.trim()) error(['contactSummary'], '请填写沟通记录。');
    }
    if (conclusion === 'confirmed' && !d.measures.length) error(['measures'], '确认预警时须填写处置措施。');
    if (disposition === 'escalate' && !d.measures.some((row) => row.kind === 'escalate'))
      error(['measures'], '升级处置须包含升级报告措施。');
    if (conclusion === 'false-positive' && disposition !== 'close') error(['measures'], '演示误报应选择关闭处置。');
  }
  if (new Set(d.checks.map((r) => r.id)).size !== d.checks.length) error(['checks'], '明细行编号不能重复。');
  if (new Set(d.measures.map((r) => r.id)).size !== d.measures.length) error(['measures'], '明细行编号不能重复。');
  d.checks.forEach((r, index) => {
    if (r.tradeDate && !dateValid(r.tradeDate)) error(['checks', index, 'tradeDate'], '日期无效。');
    if (
      r.instrument &&
      !DEMO_MARKETS.some((m) => m.id === r.market && m.instruments.some((code) => code === r.instrument))
    )
      error(['checks', index, 'instrument'], '品种与所选市场不匹配。');
    if (r.accountRef && !/^DEMO-[A-Z0-9-]{1,35}$/.test(r.accountRef))
      error(['checks', index, 'accountRef'], '请使用 DEMO- 开头的虚构账户编号。');
    if (final) {
      for (const field of ['accountRef', 'market', 'instrument', 'tradeDate', 'direction', 'finding'] as const)
        if (!r[field]) error(['checks', index, field], '请补齐核查明细的必填字段。');
      if (r.amountCents <= 0) error(['checks', index, 'amountCents'], '核查金额须大于零。');
      if (r.tradeDate && (r.tradeDate < d.periodStart || r.tradeDate > d.periodEnd))
        error(['checks', index, 'tradeDate'], '业务日期须在核查期间内。');
      if (r.finding !== 'normal' && !r.note.trim())
        error(['checks', index, 'note'], '异常或待确认事项须填写核查说明。');
    }
  });
  d.measures.forEach((r, index) => {
    if (r.dueDate && !dateValid(r.dueDate)) error(['measures', index, 'dueDate'], '日期无效。');
    if (r.ownerId && !state.employees.some((e) => e.id === r.ownerId && e.active))
      error(['measures', index, 'ownerId'], '责任人不存在或已停用。');
    if (final) {
      for (const field of ['kind', 'ownerId', 'dueDate', 'description'] as const)
        if (!r[field].trim()) error(['measures', index, field], '请补齐处置措施的必填字段。');
      if (r.dueDate && r.dueDate < d.periodEnd) error(['measures', index, 'dueDate'], '完成期限不能早于核查结束日期。');
    }
  });
  return errors;
}
