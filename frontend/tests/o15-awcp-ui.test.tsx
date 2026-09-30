import { expect, it } from 'vitest';
import O15ItPage from '../src/pc/pages/O15ItPage';
import { replayReadPage } from './replayReadPage';

it('O15 exposes a readable contract and rejects an unknown actor without mutating data', async () => {
  const result = await replayReadPage('O15', O15ItPage, 'office.it.read');
  expect(result.success).toMatchObject({ ok: true });
  expect(result.invalid).toMatchObject({ ok: false });
  expect(result.after).toEqual(result.before);
  expect(result.visible?.length).toBeGreaterThan(0);
});
