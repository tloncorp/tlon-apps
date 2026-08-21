import { describe, expect, test, vi } from 'vitest';

import {
  type ContactsUpdate,
  contactSelfFieldPoke,
  contactToClientProfile,
  directoryToClientProfiles,
  extractBotInfoValue,
  subscribeToContactUpdates,
  v1PeerToClientProfile,
} from '../client/contactsApi';
import { subscribe } from '../client/urbit';
import type { ContactBookProfile } from '../urbit/contact';

vi.mock('../client/urbit', async () => {
  const actual =
    await vi.importActual<typeof import('../client/urbit')>('../client/urbit');
  return {
    ...actual,
    subscribe: vi.fn(),
  };
});

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
      botInfo: null,
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
      botInfo: null,
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
//
// The entry carries nothing *but* the claim on purpose: a bot that publishes
// only `bot-info` is a profile the non-empty filter above keeps, and a fixture
// with a nickname would survive a converter that dropped bot-info-only rows.
test('a directory entry carries its bot-info claim onto the client row', () => {
  const claim = JSON.stringify({ v: 1, harness: 'hermes', version: '0.15.0' });
  const profiles = directoryToClientProfiles({
    '~zod': {
      isContact: false,
      contact: {
        ['bot-info']: { type: 'text' as const, value: claim },
      },
      mod: {},
    },
  });
  expect(profiles).toHaveLength(1);
  expect(profiles[0].botInfo).toBe(claim);
});

describe('contactSelfFieldPoke', () => {
  test('builds the self-merge action for a namespaced field', () => {
    expect(
      contactSelfFieldPoke('bot-info', { type: 'text', value: '{"v":1}' })
    ).toEqual({
      app: 'contacts',
      mark: 'contact-action-1',
      json: { self: { ['bot-info']: { type: 'text', value: '{"v":1}' } } },
    });
  });

  test('null deletes the key (contact keys only die by explicit null)', () => {
    expect(contactSelfFieldPoke('bot-info', null)).toEqual({
      app: 'contacts',
      mark: 'contact-action-1',
      json: { self: { ['bot-info']: null } },
    });
  });
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

// The carrier that keeps a bot's identity claim current between directory
// syncs: the live `/v1/news` subscription.
describe('bot-info sync carrier', () => {
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
});
