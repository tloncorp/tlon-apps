import { type Mock, beforeEach, expect, test, vi } from 'vitest';

import { joinChannel, leaveChannel } from './channelsApi';
import { trackedPoke } from './urbit';

vi.mock('./urbit', async () => {
  const actual = await vi.importActual<typeof import('./urbit')>('./urbit');
  return {
    ...actual,
    trackedPoke: vi.fn(),
  };
});

const trackedPokeMock = trackedPoke as unknown as Mock;

const channelId = 'chat/~zod/general';

beforeEach(() => {
  vi.clearAllMocks();
  trackedPokeMock.mockResolvedValue(undefined);
});

// Fed the events %channels gives on /v4, in the shape the ship sends them. A
// predicate that never matches leaves the poke waiting out its timeout and
// then throwing.
const trackedPredicate = () =>
  trackedPokeMock.mock.calls[0][2] as (event: unknown) => boolean;

test('leaveChannel is confirmed by the %leave response for its channel', async () => {
  await leaveChannel(channelId);
  const matches = trackedPredicate();

  expect(matches({ nest: channelId, response: { leave: null } })).toBe(true);
  expect(matches({ nest: 'chat/~zod/other', response: { leave: null } })).toBe(
    false
  );
  expect(matches({ nest: channelId, response: { join: '~zod/group' } })).toBe(
    false
  );
});

test('joinChannel is confirmed by the %join response for its channel', async () => {
  await joinChannel(channelId, '~zod/group');
  const matches = trackedPredicate();

  expect(matches({ nest: channelId, response: { join: '~zod/group' } })).toBe(
    true
  );
  expect(
    matches({ nest: 'chat/~zod/other', response: { join: '~zod/group' } })
  ).toBe(false);
});
