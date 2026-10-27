import { expect, test, vi } from 'vitest';

import { updateDMMeta } from '../client/chatApi';
import { trackedPoke } from '../client/urbit';
import type * as ub from '../urbit';

vi.mock('../client/urbit', async () => ({
  ...(await vi.importActual('../client/urbit')),
  trackedPoke: vi.fn(),
}));

const meta: ub.GroupMeta = {
  title: 'renamed',
  description: '',
  image: '',
  cover: '',
};

function clubAction(id: string, delta: ub.ClubDelta): ub.ClubAction {
  return { id, diff: { uid: '0v2', delta } };
}

test('updateDMMeta waits for the meta action of its own group DM', async () => {
  vi.mocked(trackedPoke).mockResolvedValueOnce(undefined);
  await updateDMMeta({ channelId: '0v1', meta: { title: 'renamed' } });

  const predicate = vi.mocked(trackedPoke).mock.calls[0][2] as (
    event: ub.ClubAction
  ) => boolean;
  expect(predicate(clubAction('0v1', { meta }))).toBe(true);
  expect(predicate(clubAction('0v9', { meta }))).toBe(false);
  expect(
    predicate(clubAction('0v1', { team: { ship: '~zod', ok: true } }))
  ).toBe(false);
});
