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

const SIBLING = '~marzod-sampel-palnet';

// registerBotProfile scries /v1/self (the claim) then /v1/directory (the
// bot's current profile, merged into the update)
const mockBotProfileScries = (
  self: ContactBookProfile,
  directory: Record<string, unknown> = {}
) => {
  vi.mocked(scry).mockImplementation(async ({ path }: { path: string }) =>
    path === '/v1/self' ? (self as never) : (directory as never)
  );
};

test('registerBotProfile claims the moon (list) and publishes its real profile', async () => {
  mockBotProfileScries({
    nickname: { type: 'text', value: 'Host' },
    bots: { type: 'set', value: [{ type: 'ship', value: SIBLING }] },
  } as ContactBookProfile);
  vi.mocked(poke).mockResolvedValue(undefined as never);

  await registerBotProfile(MOON, { nickname: 'Helper', avatar: 'http://x/a' });

  // two pokes: the claim (contact-action-1) then the real profile (contact-bot-0)
  expect(poke).toHaveBeenCalledTimes(2);
  const claim = vi.mocked(poke).mock.calls[0][0] as {
    app: string;
    mark: string;
    json: { self: { bots: { type: string; value: unknown } } };
  };
  expect(claim).toMatchObject({ app: 'contacts', mark: 'contact-action-1' });
  // the claim is a native %set of %ship values; sibling preserved, moon added
  expect(claim.json.self.bots).toEqual({
    type: 'set',
    value: [
      { type: 'ship', value: SIBLING },
      { type: 'ship', value: MOON },
    ],
  });

  const profile = vi.mocked(poke).mock.calls[1][0] as {
    app: string;
    mark: string;
    json: { who: string; con: Record<string, { type: string; value: string }> };
  };
  expect(profile).toMatchObject({ app: 'contacts', mark: 'contact-bot-0' });
  expect(profile.json).toEqual({
    who: MOON,
    con: {
      nickname: { type: 'text', value: 'Helper' },
      avatar: { type: 'look', value: 'http://x/a' },
    },
  });
});

test('registerBotProfile skips the claim poke when the moon is already claimed', async () => {
  mockBotProfileScries({
    bots: { type: 'set', value: [{ type: 'ship', value: MOON }] },
  } as ContactBookProfile);
  vi.mocked(poke).mockResolvedValue(undefined as never);

  await registerBotProfile(MOON, { nickname: 'Helper' });

  // only the real-profile poke; the claim is already present
  expect(poke).toHaveBeenCalledTimes(1);
  expect(vi.mocked(poke).mock.calls[0][0]).toMatchObject({
    mark: 'contact-bot-0',
  });
});

test('registerBotProfile merges a partial update into the existing profile', async () => {
  mockBotProfileScries(
    {
      bots: { type: 'set', value: [{ type: 'ship', value: MOON }] },
    } as ContactBookProfile,
    {
      [MOON]: {
        isContact: false,
        contact: {
          nickname: { type: 'text', value: 'Helper' },
          avatar: { type: 'look', value: 'http://x/a' },
          bio: { type: 'text', value: 'old bio' },
        },
        mod: {},
      },
    }
  );
  vi.mocked(poke).mockResolvedValue(undefined as never);

  // update bio, clear avatar, leave nickname alone
  await registerBotProfile(MOON, { bio: 'new bio', avatar: null });

  expect(poke).toHaveBeenCalledTimes(1);
  const arg = vi.mocked(poke).mock.calls[0][0] as {
    mark: string;
    json: { who: string; con: Record<string, { type: string; value: string }> };
  };
  expect(arg.mark).toBe('contact-bot-0');
  expect(arg.json.con).toEqual({
    nickname: { type: 'text', value: 'Helper' },
    bio: { type: 'text', value: 'new bio' },
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
