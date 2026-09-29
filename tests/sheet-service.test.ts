import { expect, it } from 'vitest';

import { DemoRepository } from '../src/common/store/repository';
import { SheetService, type SheetQueryInput } from '../src/pc/service/sheetService';

const FILTER = {
  actorId: 'EMP-004',
  keyword: '',
  departmentId: null,
  status: null,
  minAmountCents: null,
  sortBy: 'amountCents',
  sortDirection: 'desc'
} as const;
const QUERY: SheetQueryInput = { ...FILTER, page: 1, pageSize: 2 };

it('keeps filtering, sorting, total and current-page semantics aligned', () => {
  const service = new SheetService(new DemoRepository());
  expect(service.query(QUERY)).toMatchObject({
    total: 5,
    page: 1,
    pageSize: 2,
    totalPages: 3,
    items: [
      { id: 'SROW-004', amountCents: 16800 },
      { id: 'SROW-001', amountCents: 12000 }
    ]
  });
  expect(service.query({ ...QUERY, page: 2 })).toMatchObject({
    total: 5,
    page: 2,
    items: [{ id: 'SROW-002' }, { id: 'SROW-005' }]
  });
  expect(service.query({ ...QUERY, departmentId: 'DEP-001', status: 'confirmed', page: 1 })).toMatchObject({
    total: 1,
    totalPages: 1,
    items: [{ id: 'SROW-003' }]
  });
  expect(service.query({ ...QUERY, keyword: '不存在' })).toMatchObject({ total: 0, totalPages: 0, items: [] });
  expect(service.validateQuery({ ...QUERY, page: 0 })).toContainEqual(expect.objectContaining({ path: ['page'] }));
});

it('locates every invalid batch field and never partially writes', () => {
  const repository = new DemoRepository();
  const service = new SheetService(repository);
  const patch = {
    actorId: 'EMP-004',
    idempotencyKey: 'o07-batch',
    changes: [
      {
        rowId: 'SROW-001',
        expectedVersion: 1,
        label: '虚构客户资料更新',
        amountCents: 13000,
        status: 'confirmed' as const
      },
      { rowId: 'SROW-002', expectedVersion: 0, label: '', amountCents: -1, status: 'draft' as const }
    ]
  };
  const before = repository.snapshot();
  expect(service.validatePatch(patch).map((item) => item.path)).toEqual([
    ['changes', 1, 'expectedVersion'],
    ['changes', 1, 'label'],
    ['changes', 1, 'amountCents']
  ]);
  expect(() => service.patch(patch)).toThrow();
  expect(repository.snapshot()).toEqual(before);
  const valid = {
    ...patch,
    changes: [
      patch.changes[0],
      { ...patch.changes[1], expectedVersion: 1, label: '虚构研究资料更新', amountCents: 9000 }
    ]
  };
  expect(service.patch(valid).rows).toMatchObject([
    { id: 'SROW-001', businessVersion: 2 },
    { id: 'SROW-002', businessVersion: 2 }
  ]);
  expect(service.patch(valid).rows).toHaveLength(2);
  expect(repository.snapshot().sheetPatchRecords).toHaveLength(1);
  expect(service.validatePatch({ ...valid, idempotencyKey: 'o07-stale' })).toContainEqual(
    expect.objectContaining({ path: ['changes', 0, 'expectedVersion'] })
  );
  expect(service.validatePatch({ ...valid, changes: [valid.changes[0]] })).toContainEqual(
    expect.objectContaining({ path: ['idempotencyKey'] })
  );
});

it('previews import errors without mutating rows and exports every filtered row as a fixed CSV snapshot', () => {
  const repository = new DemoRepository();
  const service = new SheetService(repository);
  const before = repository.snapshot();
  expect(
    service.checkImport({
      actorId: 'EMP-004',
      rows: [
        { departmentId: 'DEP-001', label: '虚构导入甲', amountCents: 5000, status: 'draft' },
        { departmentId: 'DEP-999', label: '', amountCents: -1, status: 'bad' },
        { departmentId: 'DEP-001', label: '虚构导入甲', amountCents: 100, status: 'confirmed' }
      ]
    })
  ).toEqual({
    rowCount: 3,
    validCount: 1,
    imported: false,
    errorRows: [
      {
        rowNumber: 2,
        errors: [
          { field: 'departmentId', message: '部门不存在。' },
          { field: 'label', message: '名称须为 1 到 80 字。' },
          { field: 'amountCents', message: '金额须为 0 到 100000000 的整数分。' },
          { field: 'status', message: '状态无效。' }
        ]
      },
      { rowNumber: 3, errors: [{ field: 'label', message: '导入文件内名称重复。' }] }
    ]
  });
  expect(repository.snapshot()).toEqual(before);
  const exported = service.export({ ...FILTER, departmentId: 'DEP-001', idempotencyKey: 'o07-export' });
  expect(exported).toMatchObject({ assetId: 'SHEETAST-001', rowCount: 2, mimeType: 'text/csv' });
  const csv = service.exportAsset(exported.assetId)?.content;
  expect(csv).toContain('"SROW-001","DEP-001"');
  expect(csv).toContain('"SROW-003","DEP-001"');
  expect(csv).not.toContain('SROW-002');
  expect(service.export({ ...FILTER, departmentId: 'DEP-001', idempotencyKey: 'o07-export' })).toEqual(exported);
  expect(repository.snapshot().sheetExports).toHaveLength(1);
  expect(service.validateExport({ ...FILTER, departmentId: 'DEP-002', idempotencyKey: 'o07-export' })).toContainEqual(
    expect.objectContaining({ path: ['idempotencyKey'] })
  );
});
