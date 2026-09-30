import { expect, it } from 'vitest';
import O05MeetingPage from '../src/pc/pages/O05MeetingPage';
import { replayReadPage } from './replayReadPage';

it('O05 exposes a readable contract and rejects an unknown actor without mutating data', async () => {
  const result = await replayReadPage('O05', O05MeetingPage, 'office.meeting.read');
  expect(result.success).toMatchObject({ ok: true });
  expect(result.invalid).toMatchObject({ ok: false });
  expect(result.after).toEqual(result.before);
  expect(result.visible?.length).toBeGreaterThan(0);
});
