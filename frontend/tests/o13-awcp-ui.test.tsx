import { expect, it } from 'vitest';
import O13AdminPage from '../src/pc/pages/O13AdminPage';
import { replayReadPage } from './replayReadPage';

it('O13 exposes a readable contract and rejects an unknown actor without mutating data', async () => {
  const result = await replayReadPage('O13', O13AdminPage, 'office.admin.read');
  expect(result.success).toMatchObject({ ok: true });
  expect(result.invalid).toMatchObject({ ok: false });
  expect(result.after).toEqual(result.before);
  expect(result.visible?.length).toBeGreaterThan(0);
});
