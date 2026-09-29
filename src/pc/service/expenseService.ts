import type { AwcpFieldError, JsonObject } from '@app/awcp';

import { businessError, fieldError } from '../../common/awcp/contracts';
import type { DemoState, ExpenseClaim, ExpenseLineItem, ExpenseReceipt } from '../../common/fixtures/types';
import type { DemoRepository } from '../../common/store/repository';

export interface ExpenseCheckInput extends JsonObject {
  actorId: string;
  travelFormId: string;
  receipts: ExpenseReceipt[];
  lineItems: ExpenseLineItem[];
  declaredTotalCents: number;
  idempotencyKey: string;
}

export interface ExpenseCheckResult extends JsonObject {
  expenseFormId: string;
  status: 'checked';
  businessVersion: number;
  declaredTotalCents: number;
}

const OPERATION = 'expense.check';

export class ExpenseService {
  constructor(private readonly repository: DemoRepository) {}

  subscribe(listener: () => void): () => void {
    return this.repository.subscribe(listener);
  }

  eligibleTrips(): Array<{ formId: string; applicantId: string; status: string }> {
    const state = this.repository.snapshot();
    return state.travelRequests.flatMap((trip) => {
      const form = state.forms.find((item) => item.id === trip.formId);
      return form && (form.status === 'submitted' || form.status === 'approved')
        ? [{ formId: form.id, applicantId: form.applicantId, status: form.status }]
        : [];
    });
  }

  availableReceipts(travelFormId: string) {
    return this.repository.snapshot().attachments.filter((asset) => asset.ownerId === travelFormId);
  }

  list(): ExpenseClaim[] {
    return this.repository.snapshot().expenseClaims;
  }

  validate(input: ExpenseCheckInput): AwcpFieldError[] {
    const state = this.repository.snapshot();
    const record = state.idempotencyRecords.find((item) => item.key === input.idempotencyKey);
    if (record)
      return record.operation === OPERATION && record.fingerprint === fingerprint(input)
        ? []
        : [fieldError(['idempotencyKey'], '业务幂等键已用于其他操作或参数。')];
    return validateExpense(state, input);
  }

  check(input: ExpenseCheckInput): ExpenseCheckResult {
    return this.repository.transact((draft) => {
      const record = draft.idempotencyRecords.find((item) => item.key === input.idempotencyKey);
      if (record) {
        if (record.operation !== OPERATION || record.fingerprint !== fingerprint(input)) {
          throw businessError('action.idempotency-conflict', '业务幂等键已用于其他操作或参数。');
        }
        const claim = draft.expenseClaims.find((item) => item.formId === record.resultId);
        if (!claim) throw businessError('action.expense-not-found', '已校验的费用记录不存在。');
        return {
          expenseFormId: record.resultId,
          status: 'checked',
          businessVersion: record.resultVersion ?? 1,
          declaredTotalCents: record.resultAmountCents ?? claim.declaredTotalCents
        };
      }
      const errors = validateExpense(draft, input);
      if (errors.length)
        throw businessError('action.invalid-expense', errors.flatMap((error) => error.messages).join('；'));

      const formId = nextId(
        'FORM',
        draft.forms.map((item) => item.id)
      );
      draft.forms.push({
        id: formId,
        kind: 'expense',
        applicantId: input.actorId,
        departmentId: draft.forms.find((item) => item.id === input.travelFormId)?.departmentId ?? '',
        status: 'draft',
        businessVersion: 1,
        amountCents: input.declaredTotalCents,
        createdAt: this.repository.clock.now()
      });
      draft.expenseClaims.push({
        formId,
        travelFormId: input.travelFormId,
        receipts: input.receipts.map((receipt) => ({ ...receipt })),
        lineItems: input.lineItems.map((item) => ({ ...item })),
        declaredTotalCents: input.declaredTotalCents,
        checkedVersion: 1
      });
      draft.auditEntries.push({
        id: nextId(
          'AUD',
          draft.auditEntries.map((entry) => entry.id)
        ),
        entityType: 'form',
        entityId: formId,
        action: 'expense-check',
        actorId: input.actorId,
        at: this.repository.clock.now(),
        fromStatus: null,
        toStatus: 'draft',
        businessVersion: 1
      });
      draft.idempotencyRecords.push({
        key: input.idempotencyKey,
        operation: OPERATION,
        fingerprint: fingerprint(input),
        resultId: formId,
        resultVersion: 1,
        resultStatus: 'checked',
        resultAmountCents: input.declaredTotalCents
      });
      return {
        expenseFormId: formId,
        status: 'checked',
        businessVersion: 1,
        declaredTotalCents: input.declaredTotalCents
      };
    });
  }
}

function fingerprint(input: ExpenseCheckInput): string {
  return JSON.stringify([input.actorId, input.travelFormId, input.receipts, input.lineItems, input.declaredTotalCents]);
}

export function validateExpense(state: DemoState, input: ExpenseCheckInput, excludedFormId?: string): AwcpFieldError[] {
  const errors: AwcpFieldError[] = [];
  if (typeof input.idempotencyKey !== 'string' || !/^[\w.:-]{1,128}$/.test(input.idempotencyKey)) {
    errors.push(fieldError(['idempotencyKey'], '业务幂等键格式不正确。'));
  }
  const trip = state.forms.find((item) => item.id === input.travelFormId && item.kind === 'travel');
  if (
    !trip ||
    !state.travelRequests.some((item) => item.formId === trip.id) ||
    (trip.status !== 'submitted' && trip.status !== 'approved')
  ) {
    errors.push(fieldError(['travelFormId'], '出差申请不存在或未提交。'));
  }
  const actor = state.employees.find((item) => item.id === input.actorId && item.active);
  if (!actor || !actor.roles.includes('employee') || actor.id !== trip?.applicantId) {
    errors.push(fieldError(['actorId'], '只有出差申请人可以核验费用。'));
  }
  if (!Array.isArray(input.receipts) || input.receipts.length < 1 || input.receipts.length > 20) {
    errors.push(fieldError(['receipts'], '请选择 1～20 张票据。'));
  } else {
    const seenInvoices = new Set<string>();
    const seenAssets = new Set<string>();
    input.receipts.forEach((receipt, index) => {
      const invoiceNo = typeof receipt?.invoiceNo === 'string' ? receipt.invoiceNo.trim() : '';
      if (!invoiceNo || invoiceNo.length > 64)
        errors.push(fieldError(['receipts', index, 'invoiceNo'], '票据编号必须是 1～64 字。'));
      else if (
        seenInvoices.has(invoiceNo) ||
        state.expenseClaims.some(
          (claim) => claim.formId !== excludedFormId && claim.receipts.some((old) => old.invoiceNo === invoiceNo)
        )
      ) {
        errors.push(fieldError(['receipts', index, 'invoiceNo'], '票据编号已使用，不可重复报销。'));
      }
      seenInvoices.add(invoiceNo);
      if (
        seenAssets.has(receipt.assetId) ||
        !state.attachments.some((asset) => asset.assetId === receipt.assetId && asset.ownerId === input.travelFormId) ||
        state.expenseClaims.some(
          (claim) => claim.formId !== excludedFormId && claim.receipts.some((old) => old.assetId === receipt.assetId)
        )
      ) {
        errors.push(fieldError(['receipts', index, 'assetId'], '票据附件无效或已使用。'));
      }
      seenAssets.add(receipt.assetId);
      if (!Number.isSafeInteger(receipt.amountCents) || receipt.amountCents <= 0) {
        errors.push(fieldError(['receipts', index, 'amountCents'], '票据金额必须是正整数分。'));
      }
    });
  }
  if (!Array.isArray(input.lineItems) || input.lineItems.length < 1 || input.lineItems.length > 40) {
    errors.push(fieldError(['lineItems'], '请选择 1～40 条费用明细。'));
  } else {
    input.lineItems.forEach((item, index) => {
      if (!['transport', 'hotel', 'meal', 'other'].includes(item?.category)) {
        errors.push(fieldError(['lineItems', index, 'category'], '费用类别无效。'));
      }
      if (!Array.isArray(input.receipts) || !input.receipts.some((receipt) => receipt.invoiceNo === item.invoiceNo)) {
        errors.push(fieldError(['lineItems', index, 'invoiceNo'], '明细必须关联本次票据。'));
      }
      if (!Number.isSafeInteger(item.amountCents) || item.amountCents <= 0) {
        errors.push(fieldError(['lineItems', index, 'amountCents'], '明细金额必须是正整数分。'));
      }
    });
  }
  if (!Number.isSafeInteger(input.declaredTotalCents) || input.declaredTotalCents <= 0) {
    errors.push(fieldError(['declaredTotalCents'], '申报总额必须是正整数分。'));
  } else if (Array.isArray(input.receipts) && Array.isArray(input.lineItems)) {
    const receiptTotal = input.receipts.reduce((sum, receipt) => sum + receipt.amountCents, 0);
    const lineTotal = input.lineItems.reduce((sum, item) => sum + item.amountCents, 0);
    if (
      !Number.isSafeInteger(receiptTotal) ||
      !Number.isSafeInteger(lineTotal) ||
      receiptTotal !== input.declaredTotalCents ||
      lineTotal !== input.declaredTotalCents
    ) {
      errors.push(fieldError(['declaredTotalCents'], '申报总额必须与票据金额和明细总额一致。'));
    }
    input.receipts.forEach((receipt, index) => {
      const matching = input.lineItems.filter((item) => item.invoiceNo === receipt.invoiceNo);
      if (matching.reduce((sum, item) => sum + item.amountCents, 0) !== receipt.amountCents) {
        errors.push(fieldError(['receipts', index, 'amountCents'], '该票据金额与所关联的明细金额不一致。'));
      }
    });
  }
  return errors;
}

function nextId(prefix: string, ids: readonly string[]): string {
  const max = ids.reduce((current, id) => {
    const match = new RegExp(`^${prefix}-([0-9]+)$`).exec(id);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
