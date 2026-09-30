import { expect, it } from 'vitest';
import O16ReportPage from '../src/pc/pages/O16ReportPage';
import { replayReadPage } from './replayReadPage';

it('O16 exposes a readable contract and rejects an unknown actor without mutating data', async () => {
  const result = await replayReadPage('O16', O16ReportPage, 'office.report.read');
  expect(result.success).toMatchObject({ ok: true });
  expect(result.invalid).toMatchObject({ ok: false });
  expect(result.after).toEqual(result.before);
  expect(result.visible?.length).toBeGreaterThan(0);
});
