import { describe, expect, test, vi } from 'vitest';

import {
  type ContactsUpdate,
  contactToClientProfile,
  extractBotInfoValue,
  getContactProfile,
  subscribeToContactUpdates,
  v0PeerToClientProfile,
  v0PeersToClientProfiles,
  v1PeerToClientProfile,
} from '../client/contactsApi';
import { scry, subscribe } from '../client/urbit';
import type { ContactBookProfile } from '../urbit/contact';

vi.mock('../client/urbit', async () => {
  const actual =
    await vi.importActual<typeof import('../client/urbit')>('../client/urbit');
  return {
    ...actual,
    scry: vi.fn(),
    subscribe: vi.fn(),
  };
});

const scryMock = scry as unknown as ReturnType<typeof vi.fn>;
const subscribeMock = subscribe as unknown as ReturnType<typeof vi.fn>;

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

describe('bot-info contact field', () => {
  const claimJson = JSON.stringify({
    v: 1,
    harness: 'openclaw',
    version: '0.19.0',
  });

  test('v1 peer mapper carries a well-formed text field', () => {
    const contact = v1PeerToClientProfile('~bot', {
      nickname: { type: 'text', value: 'Bot' },
      'bot-info': { type: 'text', value: claimJson },
    });
    expect(contact.botInfo).toBe(claimJson);
  });

  test('v1 peer mapper clears (null) when the field is absent', () => {
    const contact = v1PeerToClientProfile('~bot', {
      nickname: { type: 'text', value: 'Bot' },
    });
    expect(contact.botInfo).toBeNull();
  });

  test.each([
    ['set field', { type: 'set', value: [] }],
    ['numb field', { type: 'numb', value: '0x1' }],
    ['look field', { type: 'look', value: 'https://example.com' }],
    ['text field with non-string value', { type: 'text', value: 42 }],
    ['text field missing value', { type: 'text' }],
    ['bare string', claimJson],
    ['array', [{ type: 'text', value: claimJson }]],
    ['null', null],
  ])('v1 peer mapper rejects wrong shape: %s', (_label, field) => {
    const contact = v1PeerToClientProfile('~bot', {
      'bot-info': field,
    } as unknown as ContactBookProfile);
    expect(contact.botInfo).toBeNull();
  });

  test('book mapper reads the base contact, not the mod overlay', () => {
    const contact = contactToClientProfile('~bot', [
      { 'bot-info': { type: 'text', value: claimJson } },
      {
        'bot-info': {
          type: 'text',
          value: '{"v":1,"harness":"hermes","version":"9"}',
        },
      },
    ]);
    expect(contact.botInfo).toBe(claimJson);
  });

  test('book mapper carries the base field when there is no overlay', () => {
    const contact = contactToClientProfile('~bot', [
      { 'bot-info': { type: 'text', value: claimJson } },
      null,
    ]);
    expect(contact.botInfo).toBe(claimJson);
  });

  test('book mapper ignores a claim that only exists in the overlay', () => {
    const contact = contactToClientProfile('~bot', [
      {},
      { 'bot-info': { type: 'text', value: claimJson } },
    ]);
    expect(contact.botInfo).toBeNull();
  });

  test('extractBotInfoValue accepts only text-shaped fields', () => {
    expect(extractBotInfoValue({ type: 'text', value: claimJson })).toBe(
      claimJson
    );
    expect(extractBotInfoValue(undefined)).toBeNull();
    expect(extractBotInfoValue({ type: 'text', value: null })).toBeNull();
    expect(extractBotInfoValue({ value: claimJson })).toBeNull();
  });
});

// The two carriers that recover a bot's identity claim after the lossy v0
// `/all` sync: the live `/v1/news` subscription and the targeted v1 scry.
describe('bot-info sync carriers', () => {
  const claim = JSON.stringify({
    v: 1,
    harness: 'openclaw',
    version: '0.19.0',
  });

  function capturedNewsHandler() {
    const updates: ContactsUpdate[] = [];
    subscribeMock.mockClear();
    subscribeToContactUpdates((update) => updates.push(update));
    const [params, onEvent] = subscribeMock.mock.calls[0];
    expect(params).toEqual({ app: 'contacts', path: '/v1/news' });
    return { updates, onEvent: onEvent as (event: unknown) => void };
  }

  test('a %peer fact carries the claim through the subscription', () => {
    const { updates, onEvent } = capturedNewsHandler();

    onEvent({
      peer: {
        who: '~bot',
        contact: { 'bot-info': { type: 'text', value: claim } },
      },
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      type: 'upsertContact',
      contact: { id: '~bot', botInfo: claim },
    });
  });

  test('a %page fact carries the claim from the base contact', () => {
    const { updates, onEvent } = capturedNewsHandler();

    onEvent({
      page: {
        kip: '~bot',
        contact: { 'bot-info': { type: 'text', value: claim } },
        mod: null,
      },
    });

    expect(updates[0]).toMatchObject({
      type: 'upsertContact',
      contact: { id: '~bot', botInfo: claim },
    });
  });

  test('a fact without the key clears the stored claim', () => {
    const { updates, onEvent } = capturedNewsHandler();

    onEvent({ peer: { who: '~bot', contact: { nickname: 'Bot' } } });

    expect(updates[0]).toMatchObject({
      type: 'upsertContact',
      contact: { id: '~bot', botInfo: null },
    });
  });

  test('getContactProfile scries the un-suffixed v1 contact path', async () => {
    scryMock.mockResolvedValueOnce({
      'bot-info': { type: 'text', value: claim },
    });

    const contact = await getContactProfile('~bot');

    // No `.json` — the transport appends it; a suffixed path 404s.
    expect(scryMock).toHaveBeenCalledWith({
      app: 'contacts',
      path: '/v1/contact/~bot',
    });
    expect(contact?.botInfo).toBe(claim);
  });

  test('getContactProfile returns null when the scry fails', async () => {
    scryMock.mockRejectedValueOnce(new Error('404'));
    expect(await getContactProfile('~bot')).toBeNull();
  });
});
