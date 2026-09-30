import { createAwcpRegistry } from '@app/awcp';
import type { AwcpActionRegistration, AwcpManualIndex, AwcpManualSection } from '@app/awcp';
import { expect, it } from 'vitest';

import {
  accepted,
  businessError,
  completed,
  describeAction,
  describePage,
  fieldError
} from '../src/common/awcp/contracts';
import { DemoRepository } from '../src/common/store/repository';

const site = {
  name: '差旅申请测试页',
  description: describePage({
    purpose: '提交虚构差旅申请。',
    regions: '显示申请单与当前状态。',
    flow: '先读取方法章节，再按示例调用。',
    limits: '仅用于本地演示数据。'
  })
};

const inputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['formId'],
  properties: {
    formId: { type: 'string', pattern: '^FORM-[0-9]{3}$' }
  }
};

it('publishes the current manual contract and executes its legal example', async () => {
  const repository = new DemoRepository();
  const registry = createAwcpRegistry(site);
  let validationCalls = 0;
  let writes = 0;
  const registration: AwcpActionRegistration = {
    action: 'travel.approve',
    title: '批准差旅申请',
    description: describeAction({
      purpose: '批准一张已提交的申请。',
      prerequisites: 'FORM-001 存在且状态为 submitted。',
      parameters: 'formId 是页面显示的申请单 ID。',
      effects: '申请状态改为 approved，业务版本加一。',
      result: '返回 completed 和更新后的业务版本。',
      failures: '不存在或状态不符时返回字段错误；写入异常返回受控业务错误。'
    }),
    inputSchema,
    examples: [{ formId: 'FORM-001' }],
    validate(args) {
      validationCalls += 1;
      const state = repository.snapshot();
      const form = state.forms.find((item) => item.id === args.formId);
      return form?.status === 'submitted' ? [] : [fieldError(['formId'], '申请单不存在或未提交。')];
    },
    invoke(args) {
      writes += 1;
      const businessVersion = repository.transact((draft) => {
        const form = draft.forms.find((item) => item.id === args.formId);
        if (!form || form.status !== 'submitted') {
          throw businessError('action.form-state-changed', '申请单状态已变化，请刷新后重试。');
        }
        form.status = 'approved';
        form.businessVersion += 1;
        return form.businessVersion;
      });
      return completed({ formId: String(args.formId), businessVersion });
    }
  };
  registry.register(registration);

  try {
    const index = registry.manual() as AwcpManualIndex;
    expect(index.sections).toEqual([{ section: 'travel.approve', title: '批准差旅申请' }]);
    expect(index.site.description).toContain('页面限制：');
    const section = registry.manual({ section: 'travel.approve', revision: index.revision }) as AwcpManualSection;
    expect(Object.keys(section).sort()).toEqual(['description', 'examples', 'inputSchema', 'revision', 'section']);
    expect(section.description).toContain('执行前提：');
    expect(section.examples).toEqual([{ formId: 'FORM-001' }]);

    const before = repository.snapshot();
    const schemaFailure = await registry.invoke('travel.approve', { formId: 123 }, { revision: index.revision });
    expect(schemaFailure).toMatchObject({
      ok: false,
      error: { code: 'invalid_arguments', details: { executionStarted: false } }
    });
    expect(validationCalls).toBe(0);
    expect(writes).toBe(0);
    expect(repository.snapshot()).toEqual(before);

    const dynamicFailure = await registry.invoke(
      'travel.approve',
      { formId: 'FORM-999' },
      { revision: index.revision }
    );
    expect(dynamicFailure).toMatchObject({
      ok: false,
      error: { code: 'invalid_arguments', details: { executionStarted: false } }
    });
    expect(validationCalls).toBe(1);
    expect(writes).toBe(0);
    expect(repository.snapshot()).toEqual(before);

    const example = section.examples?.[0];
    if (!example) throw new Error('Expected a legal example in the manual section.');
    const success = await registry.invoke('travel.approve', example, { revision: index.revision });
    expect(success).toMatchObject({
      ok: true,
      result: { status: 'completed', data: { formId: 'FORM-001', businessVersion: 2 } }
    });
    expect(validationCalls).toBe(2);
    expect(writes).toBe(1);
    expect(repository.snapshot().forms[0].status).toBe('approved');
    expect(accepted('JOB-001')).toEqual({ status: 'accepted', jobId: 'JOB-001' });
  } finally {
    registry.dispose();
  }
});

it('keeps invalid examples in tests and exposes controlled business errors', async () => {
  const registry = createAwcpRegistry(site);
  const common: AwcpActionRegistration = {
    action: 'travel.reject',
    title: '拒绝示例',
    description: describeAction({
      purpose: '演示受控错误。',
      prerequisites: '传入格式正确的申请单 ID。',
      parameters: 'formId 是申请单 ID。',
      effects: '不写入数据。',
      result: '此方法总是返回业务错误。',
      failures: '返回 action.demo-rejected 及业务详情。'
    }),
    inputSchema,
    invoke() {
      throw businessError('action.demo-rejected', '测试拒绝。', { retryable: false });
    }
  };

  expect(() => registry.register({ ...common, examples: [{ formId: 123 }] })).toThrow('example at index 0 is invalid');
  registry.register(common);
  try {
    const response = await registry.invoke('travel.reject', { formId: 'FORM-001' });
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'action.demo-rejected', message: '测试拒绝。', details: { retryable: false } }
    });
  } finally {
    registry.dispose();
  }
});
