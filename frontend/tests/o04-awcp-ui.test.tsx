import { expect, it } from 'vitest';
import O04CommunicationPage from '../src/pc/pages/O04CommunicationPage';
import { replayReadPage } from './replayReadPage';

it('O04 exposes a readable contract and rejects an unknown actor without mutating data', async () => {
  const result = await replayReadPage('O04', O04CommunicationPage, 'office.mail.read');
  expect(result.success).toMatchObject({ ok: true });
  expect(result.invalid).toMatchObject({ ok: false });
  expect(result.after).toEqual(result.before);
  expect(result.visible?.length).toBeGreaterThan(0);
});
