import { describe, expect, test, vi } from 'vitest';

import {
  type ContactsUpdate,
  contactToClientProfile,
  extractBotCommandsValue,
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

describe('bot-commands contact field', () => {
  const manifestJson = JSON.stringify({
    v: 1,
    commands: [{ command: '/allow', title: 'Allow' }],
  });

  test('v1 peer mapper carries a well-formed text field', () => {
    const contact = v1PeerToClientProfile('~bot', {
      nickname: { type: 'text', value: 'Bot' },
      'bot-commands': { type: 'text', value: manifestJson },
    });
    expect(contact.botCommands).toBe(manifestJson);
  });

  test('v1 peer mapper clears (null) when the field is absent', () => {
    const contact = v1PeerToClientProfile('~bot', {
      nickname: { type: 'text', value: 'Bot' },
    });
    expect(contact.botCommands).toBeNull();
  });

  test.each([
    ['set field', { type: 'set', value: [] }],
    ['numb field', { type: 'numb', value: '0x1' }],
    ['look field', { type: 'look', value: 'https://example.com' }],
    ['text field with non-string value', { type: 'text', value: 42 }],
    ['text field missing value', { type: 'text' }],
    ['bare string', manifestJson],
    ['array', [{ type: 'text', value: manifestJson }]],
    ['null', null],
  ])('v1 peer mapper rejects wrong shape: %s', (_label, field) => {
    const contact = v1PeerToClientProfile('~bot', {
      'bot-commands': field,
    } as unknown as ContactBookProfile);
    expect(contact.botCommands).toBeNull();
  });

  test('book mapper reads the base contact, not the mod overlay', () => {
    const contact = contactToClientProfile('~bot', [
      { 'bot-commands': { type: 'text', value: manifestJson } },
      { 'bot-commands': { type: 'text', value: '{"v":1,"commands":[]}' } },
    ]);
    expect(contact.botCommands).toBe(manifestJson);
  });

  test('book mapper carries the base field when there is no overlay', () => {
    const contact = contactToClientProfile('~bot', [
      { 'bot-commands': { type: 'text', value: manifestJson } },
      null,
    ]);
    expect(contact.botCommands).toBe(manifestJson);
  });

  test('book mapper ignores a manifest that only exists in the overlay', () => {
    const contact = contactToClientProfile('~bot', [
      {},
      { 'bot-commands': { type: 'text', value: manifestJson } },
    ]);
    expect(contact.botCommands).toBeNull();
  });

  test('extractBotCommandsValue accepts only text-shaped fields', () => {
    expect(extractBotCommandsValue({ type: 'text', value: manifestJson })).toBe(
      manifestJson
    );
    expect(extractBotCommandsValue(undefined)).toBeNull();
    expect(extractBotCommandsValue({ type: 'text', value: null })).toBeNull();
    expect(extractBotCommandsValue({ value: manifestJson })).toBeNull();
  });
});

// The two carriers that recover an advertised manifest after the lossy v0
// `/all` sync: the live `/v1/news` subscription and the targeted v1 scry.
describe('bot-commands sync carriers', () => {
  const manifest = JSON.stringify({
    v: 1,
    commands: [{ command: '/allow', title: 'Allow' }],
  });

  function capturedNewsHandler() {
    const updates: ContactsUpdate[] = [];
    subscribeMock.mockClear();
    subscribeToContactUpdates((update) => updates.push(update));
    const [params, onEvent] = subscribeMock.mock.calls[0];
    expect(params).toEqual({ app: 'contacts', path: '/v1/news' });
    return { updates, onEvent: onEvent as (event: unknown) => void };
  }

  test('a %peer fact carries the manifest through the subscription', () => {
    const { updates, onEvent } = capturedNewsHandler();

    onEvent({
      peer: {
        who: '~bot',
        contact: { 'bot-commands': { type: 'text', value: manifest } },
      },
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      type: 'upsertContact',
      contact: { id: '~bot', botCommands: manifest },
    });
  });

  test('a %page fact carries the manifest from the base contact', () => {
    const { updates, onEvent } = capturedNewsHandler();

    onEvent({
      page: {
        kip: '~bot',
        contact: { 'bot-commands': { type: 'text', value: manifest } },
        mod: null,
      },
    });

    expect(updates[0]).toMatchObject({
      type: 'upsertContact',
      contact: { id: '~bot', botCommands: manifest },
    });
  });

  test('a fact without the key clears the stored manifest', () => {
    const { updates, onEvent } = capturedNewsHandler();

    onEvent({ peer: { who: '~bot', contact: { nickname: 'Bot' } } });

    expect(updates[0]).toMatchObject({
      type: 'upsertContact',
      contact: { id: '~bot', botCommands: null },
    });
  });

  test('getContactProfile scries the un-suffixed v1 contact path', async () => {
    scryMock.mockResolvedValueOnce({
      'bot-commands': { type: 'text', value: manifest },
    });

    const contact = await getContactProfile('~bot');

    // No `.json` — the transport appends it; a suffixed path 404s.
    expect(scryMock).toHaveBeenCalledWith({
      app: 'contacts',
      path: '/v1/contact/~bot',
    });
    expect(contact?.botCommands).toBe(manifest);
  });

  test('getContactProfile returns null when the scry fails', async () => {
    scryMock.mockRejectedValueOnce(new Error('404'));
    expect(await getContactProfile('~bot')).toBeNull();
  });
});
