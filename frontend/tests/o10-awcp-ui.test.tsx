import { expect, it } from 'vitest';
import O10HrPage from '../src/pc/pages/O10HrPage';
import { replayReadPage } from './replayReadPage';

it('O10 exposes a readable contract and rejects an unknown actor without mutating data', async () => {
  const result = await replayReadPage('O10', O10HrPage, 'office.hr.read');
  expect(result.success).toMatchObject({ ok: true });
  expect(result.invalid).toMatchObject({ ok: false });
  expect(result.after).toEqual(result.before);
  expect(result.visible?.length).toBeGreaterThan(0);
});
