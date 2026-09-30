import { expect, it } from 'vitest';
import O12ContractPage from '../src/pc/pages/O12ContractPage';
import { replayReadPage } from './replayReadPage';

it('O12 exposes a readable contract and rejects an unknown actor without mutating data', async () => {
  const result = await replayReadPage('O12', O12ContractPage, 'office.contract.read');
  expect(result.success).toMatchObject({ ok: true });
  expect(result.invalid).toMatchObject({ ok: false });
  expect(result.after).toEqual(result.before);
  expect(result.visible?.length).toBeGreaterThan(0);
});
