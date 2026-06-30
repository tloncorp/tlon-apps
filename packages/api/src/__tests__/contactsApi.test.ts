import { expect, test, vi } from 'vitest';

vi.mock('../client/urbit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client/urbit')>();
  return { ...actual, scry: vi.fn(), poke: vi.fn() };
});

import {
  directoryToClientProfiles,
  parseBotProfiles,
  registerBotProfile,
  v0PeerToClientProfile,
  v0PeersToClientProfiles,
} from '../client/contactsApi';
import { poke, scry } from '../client/urbit';
import type { ContactBookProfile, ContactFieldText } from '../urbit/contact';

// ~doznec-sampel-palnet is a real moon sponsored by ~sampel-palnet.
const PARENT = '~sampel-palnet';
const MOON = '~doznec-sampel-palnet';

const withBots = (json: string): ContactBookProfile => ({
  bots: { type: 'text', value: json } as ContactFieldText,
});

test('registerBotProfile merges the moon into the host bots field, preserving siblings', async () => {
  vi.mocked(scry).mockResolvedValue({
    nickname: { type: 'text', value: 'Host' },
    bots: {
      type: 'text',
      value: JSON.stringify({
        '~marzod-sampel-palnet': { nickname: 'Sibling', avatar: null },
      }),
    },
  } as ContactBookProfile);
  vi.mocked(poke).mockResolvedValue(undefined as never);

  await registerBotProfile(MOON, { nickname: 'Helper', avatar: 'http://x/a' });

  expect(poke).toHaveBeenCalledTimes(1);
  const arg = vi.mocked(poke).mock.calls[0][0] as {
    app: string;
    mark: string;
    json: { self: { bots: { type: string; value: string } } };
  };
  expect(arg).toMatchObject({ app: 'contacts', mark: 'contact-action-1' });
  expect(JSON.parse(arg.json.self.bots.value)).toEqual({
    // sibling bot preserved
    '~marzod-sampel-palnet': { nickname: 'Sibling', avatar: null },
    // our moon added
    [MOON]: { nickname: 'Helper', avatar: 'http://x/a' },
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

test('parseBotProfiles materializes a bot moon published by its own parent', () => {
  const profile = withBots(
    JSON.stringify({ [MOON]: { nickname: 'Helper', avatar: 'http://x/a.png' } })
  );
  const result = parseBotProfiles(PARENT, profile);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    id: MOON,
    peerNickname: 'Helper',
    peerAvatarImage: 'http://x/a.png',
    isContact: false,
  });
});

test('parseBotProfiles normalizes a sig-less bot id', () => {
  const profile = withBots(
    JSON.stringify({ 'doznec-sampel-palnet': { nickname: 'Helper' } })
  );
  const result = parseBotProfiles(PARENT, profile);
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe(MOON);
});

test('parseBotProfiles rejects a bot profile from a ship that is not its parent', () => {
  // ~bus does not sponsor the moon, so it may not publish a profile for it
  const profile = withBots(
    JSON.stringify({ [MOON]: { nickname: 'Spoof' } })
  );
  expect(parseBotProfiles('~bus', profile)).toEqual([]);
});

test('parseBotProfiles rejects a non-moon entry', () => {
  const profile = withBots(JSON.stringify({ '~bus': { nickname: 'Planet' } }));
  expect(parseBotProfiles(PARENT, profile)).toEqual([]);
});

test('parseBotProfiles skips entries with nothing to display', () => {
  const profile = withBots(JSON.stringify({ [MOON]: {} }));
  expect(parseBotProfiles(PARENT, profile)).toEqual([]);
});

test('parseBotProfiles tolerates malformed/missing bots field', () => {
  expect(parseBotProfiles(PARENT, withBots('not json'))).toEqual([]);
  expect(parseBotProfiles(PARENT, {})).toEqual([]);
});

test('directoryToClientProfiles expands a profile and its bots', () => {
  const directory = {
    [PARENT]: {
      isContact: true,
      contact: {
        nickname: { type: 'text', value: 'Sampel' } as ContactFieldText,
        ...withBots(JSON.stringify({ [MOON]: { nickname: 'Helper' } })),
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
