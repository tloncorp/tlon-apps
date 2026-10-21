import { beforeEach, expect, test, vi } from 'vitest';

import {
  directoryToClientProfiles,
  isRegisteredBot,
  registerBotProfile,
} from '../client/contactsApi';
import { poke, scry } from '../client/urbit';
import type { ContactBookProfile } from '../urbit/contact';

vi.mock('../client/urbit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client/urbit')>();
  return { ...actual, scry: vi.fn(), poke: vi.fn() };
});

// ~doznec-sampel-palnet is a real moon sponsored by ~sampel-palnet.
const PARENT = '~sampel-palnet';
const MOON = '~doznec-sampel-palnet';

const withBots = (ships: string[]): ContactBookProfile => ({
  bots: {
    type: 'set',
    value: ships.map((value) => ({ type: 'ship' as const, value })),
  },
});

beforeEach(() => {
  vi.mocked(poke).mockClear();
  vi.mocked(scry).mockClear();
});

// registerBotProfile is a single steward poke: steward (the arbiter of bot
// data in contacts) validates the moon against its roster, merges the edit
// into the bot's profile, and maintains the host's `bots` claim itself --
// there is nothing to read, merge, or claim client-side.
test('registerBotProfile sends one steward roster %profile poke', async () => {
  vi.mocked(poke).mockResolvedValue(undefined as never);

  // update bio, clear avatar, leave everything else alone
  await registerBotProfile(MOON, { bio: 'new bio', avatar: null });

  expect(scry).not.toHaveBeenCalled();
  expect(poke).toHaveBeenCalledTimes(1);
  expect(vi.mocked(poke).mock.calls[0][0]).toEqual({
    app: 'steward',
    mark: 'steward-roster-action-1',
    json: {
      profile: {
        ship: MOON,
        edits: { bio: 'new bio', avatar: null },
      },
    },
  });
});

test('registerBotProfile normalizes the moon id and empty-string deletes', async () => {
  vi.mocked(poke).mockResolvedValue(undefined as never);

  await registerBotProfile('doznec-sampel-palnet', {
    nickname: 'Helper',
    status: '',
  });

  expect(vi.mocked(poke).mock.calls[0][0]).toEqual({
    app: 'steward',
    mark: 'steward-roster-action-1',
    json: {
      profile: {
        ship: MOON,
        edits: { nickname: 'Helper', status: null },
      },
    },
  });
});

test('isRegisteredBot is true for a moon claimed by its own parent', async () => {
  vi.mocked(scry).mockResolvedValue({
    [PARENT]: { isContact: false, contact: withBots([MOON]) },
  } as never);
  expect(await isRegisteredBot(MOON)).toBe(true);
});

test('isRegisteredBot normalizes a sig-less claim entry', async () => {
  vi.mocked(scry).mockResolvedValue({
    [PARENT]: {
      isContact: false,
      contact: withBots(['doznec-sampel-palnet']),
    },
  } as never);
  expect(await isRegisteredBot(MOON)).toBe(true);
});

test('isRegisteredBot is false when the parent does not claim the moon', async () => {
  vi.mocked(scry).mockResolvedValue({
    [PARENT]: { isContact: false, contact: withBots([]) },
  } as never);
  expect(await isRegisteredBot(MOON)).toBe(false);
});

test('isRegisteredBot is false for a non-moon ship', async () => {
  vi.mocked(scry).mockResolvedValue({} as never);
  // ~bus is a planet, not a moon — never a bot
  expect(await isRegisteredBot('~bus')).toBe(false);
});

test('isRegisteredBot fails closed: a failed directory read rejects', async () => {
  // this read gates whether a DM takes the vouched path -- a scry failure
  // must fail the send, never silently demote to peer-to-peer
  vi.mocked(scry).mockRejectedValue(new Error('scry failed'));
  await expect(isRegisteredBot(MOON)).rejects.toThrow('scry failed');
});

test('isRegisteredBot tolerates a malformed/missing bots field', async () => {
  // a non-set bots value (e.g. legacy text) decodes to no claims
  vi.mocked(scry).mockResolvedValue({
    [PARENT]: {
      isContact: false,
      contact: { bots: { type: 'text', value: 'garbage' } },
    },
  } as never);
  expect(await isRegisteredBot(MOON)).toBe(false);
});

test('directoryToClientProfiles renders a bot from its own real profile', () => {
  // The bot's name comes from its own directory entry (published by the
  // host via contact-bot-0), NOT from the parent's `bots` claim field.
  const directory = {
    [MOON]: {
      isContact: false,
      contact: {
        nickname: { type: 'text', value: 'Helper' },
      },
      mod: {},
    },
  };
  const result = directoryToClientProfiles(directory as never);
  const bot = result.find((c) => c.id === MOON);
  expect(bot).toMatchObject({ peerNickname: 'Helper' });
});

test('directoryToClientProfiles does not materialize a bot from the claim alone', () => {
  // A claim with no corresponding real profile entry yields no bot contact.
  const directory = {
    [PARENT]: {
      isContact: true,
      contact: withBots([MOON]),
      mod: {},
    },
  };
  const result = directoryToClientProfiles(directory as never);
  expect(result.find((c) => c.id === MOON)).toBeUndefined();
});
