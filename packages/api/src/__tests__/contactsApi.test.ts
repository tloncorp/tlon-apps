import { describe, expect, test, vi } from 'vitest';

import {
  type ContactsUpdate,
  contactToClientProfile,
  directoryToClientProfiles,
  extractBotInfoValue,
  getContactProfile,
  subscribeToContactUpdates,
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

const directoryResponse = {
  '~ravmel-ropdyl': {
    isContact: false,
    contact: {
      status: { type: 'text' as const, value: 'listening to music' },
      cover: {
        type: 'look' as const,
        value:
          'https://20-urbit.s3.us-west-1.amazonaws.com/ravmel-ropdyl/2021.2.13..00.31.09-Manaslu-crevasses.jpg',
      },
      bio: {
        type: 'text' as const,
        value: 'happy to chat, send a dm any time',
      },
      nickname: { type: 'text' as const, value: 'galen' },
      color: { type: 'tint' as const, value: 'ff.ffff' },
      groups: {
        type: 'set' as const,
        value: [
          { type: 'flag' as const, value: '~ravmel-ropdyl/audio-video-images' },
          { type: 'flag' as const, value: '~nibset-napwyn/tlon' },
        ],
      },
    },
    mod: {},
  },
  '~nocsyx-lassul': {
    isContact: true,
    contact: { nickname: { type: 'text' as const, value: 'polwet' } },
    mod: {},
  },
};

test('converts a directory scry to client profiles', () => {
  expect(directoryToClientProfiles(directoryResponse)).toStrictEqual([
    {
      id: '~ravmel-ropdyl',
      peerAvatarImage: null,
      peerNickname: 'galen',
      coverImage:
        'https://20-urbit.s3.us-west-1.amazonaws.com/ravmel-ropdyl/2021.2.13..00.31.09-Manaslu-crevasses.jpg',
      bio: 'happy to chat, send a dm any time',
      status: 'listening to music',
      color: '#FFFFFF',
      pinnedGroups: [
        {
          groupId: '~ravmel-ropdyl/audio-video-images',
          contactId: '~ravmel-ropdyl',
        },
        { groupId: '~nibset-napwyn/tlon', contactId: '~ravmel-ropdyl' },
      ],
      attestations: null,
      isContact: false,
      isContactSuggestion: undefined,
    },
    {
      id: '~nocsyx-lassul',
      peerAvatarImage: null,
      peerNickname: 'polwet',
      coverImage: null,
      bio: null,
      status: null,
      color: null,
      pinnedGroups: [],
      attestations: null,
      isContact: false,
      isContactSuggestion: undefined,
    },
  ]);
});

test('omits entries with no profile data from directory profiles', () => {
  const profiles = directoryToClientProfiles({
    ...directoryResponse,
    '~zod': { isContact: true, contact: {}, mod: {} },
    '~bus': { isContact: false, contact: {}, mod: {} },
  });
  expect(profiles.map((p) => p.id)).toStrictEqual([
    '~ravmel-ropdyl',
    '~nocsyx-lassul',
  ]);
});

test('omits book entries from directory profiles', () => {
  const profiles = directoryToClientProfiles(directoryResponse, {
    userIdsToOmit: new Set(['~nocsyx-lassul']),
  });
  expect(profiles.map((p) => p.id)).toStrictEqual(['~ravmel-ropdyl']);
});

// The directory scry is the bulk path a bot's claim now rides on — this is
// what let bulk sync stop special-casing `botInfo`. The composition matters:
// directory tests that skip this field plus mapper tests that never see a
// directory would both stay green if the converter dropped it.
test('a directory entry carries its bot-info claim onto the client row', () => {
  const claim = JSON.stringify({ v: 1, harness: 'hermes', version: '0.15.0' });
  const profiles = directoryToClientProfiles({
    '~zod': {
      isContact: false,
      contact: {
        nickname: { type: 'text' as const, value: 'bot' },
        ['bot-info']: { type: 'text' as const, value: claim },
      },
      mod: {},
    },
  });
  expect(profiles).toHaveLength(1);
  expect(profiles[0].botInfo).toBe(claim);
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

// The carriers that keep a bot's identity claim current between directory
// syncs: the live `/v1/news` subscription and the targeted v1 scry (which the
// backfill uses for a never-met bot the directory cannot include).
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
