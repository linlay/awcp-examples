import { expect, it } from 'vitest';
import O14ProjectPage from '../src/pc/pages/O14ProjectPage';
import { replayReadPage } from './replayReadPage';

it('O14 exposes a readable contract and rejects an unknown actor without mutating data', async () => {
  const result = await replayReadPage('O14', O14ProjectPage, 'office.project.read');
  expect(result.success).toMatchObject({ ok: true });
  expect(result.invalid).toMatchObject({ ok: false });
  expect(result.after).toEqual(result.before);
  expect(result.visible?.length).toBeGreaterThan(0);
});
