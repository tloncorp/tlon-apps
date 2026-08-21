import { beforeEach, expect, test, vi } from 'vitest';

import {
  directoryToClientProfiles,
  isRegisteredBot,
  registerBotProfile,
  v0PeerToClientProfile,
  v0PeersToClientProfiles,
} from '../client/contactsApi';
import { poke, scry } from '../client/urbit';
import type { ContactBookProfile, ContactFieldText } from '../urbit/contact';

vi.mock('../client/urbit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client/urbit')>();
  return { ...actual, scry: vi.fn(), poke: vi.fn() };
});

// ~doznec-sampel-palnet is a real moon sponsored by ~sampel-palnet.
const PARENT = '~sampel-palnet';
const MOON = '~doznec-sampel-palnet';

const withBots = (json: string): ContactBookProfile => ({
  bots: { type: 'text', value: json } as ContactFieldText,
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
    bots: { type: 'text', value: JSON.stringify([SIBLING]) },
  } as ContactBookProfile);
  vi.mocked(poke).mockResolvedValue(undefined as never);

  await registerBotProfile(MOON, { nickname: 'Helper', avatar: 'http://x/a' });

  // two pokes: the claim (contact-action-1) then the real profile (contact-bot-0)
  expect(poke).toHaveBeenCalledTimes(2);
  const claim = vi.mocked(poke).mock.calls[0][0] as {
    app: string;
    mark: string;
    json: { self: { bots: { type: string; value: string } } };
  };
  expect(claim).toMatchObject({ app: 'contacts', mark: 'contact-action-1' });
  // the claim is a plain @p list; sibling preserved, our moon appended
  expect(JSON.parse(claim.json.self.bots.value)).toEqual([SIBLING, MOON]);

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
    bots: { type: 'text', value: JSON.stringify([MOON]) },
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
      bots: { type: 'text', value: JSON.stringify([MOON]) },
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

const inputContact: [string, any] = [
  'test',
  {
    status: 'listening to music',
    avatar: null,
    cover:
      'https://20-urbit.s3.us-west-1.amazonaws.com/ravmel-ropdyl/2021.2.13..00.31.09-Manaslu-crevasses.jpg',
    bio: 'happy to chat, send a dm any time',
    nickname: 'galen',
    color: '0xff.ffff',
    groups: [
      '~ravmel-ropdyl/audio-video-images',
      '~nibset-napwyn/tlon',
      '~ravmel-ropdyl/crate',
    ],
    attestations: null,
  },
];

const outputContact = {
  id: 'test',
  peerAvatarImage: null,
  peerNickname: 'galen',
  coverImage:
    'https://20-urbit.s3.us-west-1.amazonaws.com/ravmel-ropdyl/2021.2.13..00.31.09-Manaslu-crevasses.jpg',
  bio: 'happy to chat, send a dm any time',
  status: 'listening to music',
  color: '#FFFFFF',
  pinnedGroups: [
    { groupId: '~ravmel-ropdyl/audio-video-images', contactId: 'test' },
    { groupId: '~nibset-napwyn/tlon', contactId: 'test' },
    { groupId: '~ravmel-ropdyl/crate', contactId: 'test' },
  ],
  attestations: null,
  isContact: false,
  isContactSuggestion: undefined,
};

test('converts a contact from server to client format', () => {
  expect(v0PeerToClientProfile(...inputContact)).toStrictEqual(outputContact);
});

test('converts an array of contacts from server to client format', () => {
  expect(
    v0PeersToClientProfiles({ [inputContact[0]]: inputContact[1] })
  ).toStrictEqual([outputContact]);
});

test('isRegisteredBot is true for a moon claimed by its own parent', async () => {
  vi.mocked(scry).mockResolvedValue({
    [PARENT]: { isContact: false, contact: withBots(JSON.stringify([MOON])) },
  } as never);
  expect(await isRegisteredBot(MOON)).toBe(true);
});

test('isRegisteredBot normalizes a sig-less claim entry', async () => {
  vi.mocked(scry).mockResolvedValue({
    [PARENT]: {
      isContact: false,
      contact: withBots(JSON.stringify(['doznec-sampel-palnet'])),
    },
  } as never);
  expect(await isRegisteredBot(MOON)).toBe(true);
});

test('isRegisteredBot is false when the parent does not claim the moon', async () => {
  vi.mocked(scry).mockResolvedValue({
    [PARENT]: { isContact: false, contact: withBots(JSON.stringify([])) },
  } as never);
  expect(await isRegisteredBot(MOON)).toBe(false);
});

test('isRegisteredBot is false for a non-moon ship', async () => {
  vi.mocked(scry).mockResolvedValue({} as never);
  // ~bus is a planet, not a moon — never a bot
  expect(await isRegisteredBot('~bus')).toBe(false);
});

test('isRegisteredBot tolerates a malformed/missing bots field', async () => {
  vi.mocked(scry).mockResolvedValue({
    [PARENT]: { isContact: false, contact: withBots('not json') },
  } as never);
  expect(await isRegisteredBot(MOON)).toBe(false);
});

test('directoryToClientProfiles renders a bot from its own real profile', () => {
  // The bot's name/avatar come from its own directory entry (published by the
  // host via contact-bot-0), NOT from the parent's `bots` claim field.
  const directory = {
    [PARENT]: {
      isContact: true,
      contact: {
        nickname: { type: 'text', value: 'Sampel' } as ContactFieldText,
        ...withBots(JSON.stringify([MOON])),
      },
      mod: {},
    },
    [MOON]: {
      isContact: false,
      contact: {
        nickname: { type: 'text', value: 'Helper' } as ContactFieldText,
      },
      mod: {},
    },
  };
  const result = directoryToClientProfiles(directory);
  const parent = result.find((c) => c.id === PARENT);
  const moon = result.find((c) => c.id === MOON);
  expect(parent).toMatchObject({ peerNickname: 'Sampel', isContact: true });
  expect(moon).toMatchObject({ peerNickname: 'Helper', isContact: false });
});

test('directoryToClientProfiles does not materialize a bot from the claim alone', () => {
  // A claim with no corresponding real profile entry yields no bot contact.
  const directory = {
    [PARENT]: {
      isContact: true,
      contact: {
        nickname: { type: 'text', value: 'Sampel' } as ContactFieldText,
        ...withBots(JSON.stringify([MOON])),
      },
      mod: {},
    },
  };
  const result = directoryToClientProfiles(directory);
  expect(result.find((c) => c.id === MOON)).toBeUndefined();
});
