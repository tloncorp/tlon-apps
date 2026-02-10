import { beforeAll, describe, expect, test } from 'vitest';

import {
  toContactsData,
  v0PeerToClientProfile,
  v0PeersToClientProfiles,
} from '../client/contactsApi';
import { configureClient } from '../client/urbit';
import rawContactBook from './fixtures/contactBook.json';
import rawContacts from './fixtures/contacts.json';
import rawSuggestedContacts from './fixtures/suggestedContacts.json';
import type * as ub from '../urbit';

const inputContact: [string, ub.Contact] = [
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

describe('contacts transforms contract', () => {
  beforeAll(() => {
    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    });
  });

  test('converts v0 contact shape to client contact', () => {
    expect(v0PeerToClientProfile(...inputContact)).toStrictEqual(outputContact);
  });

  test('converts v0 contacts map to client contacts list', () => {
    expect(
      v0PeersToClientProfiles({ [inputContact[0]]: inputContact[1] })
    ).toStrictEqual([outputContact]);
  });

  test('merges peers + contact book payloads', () => {
    const result = toContactsData({
      peersResponse: rawContacts as unknown as ub.ContactRolodex,
      contactsResponse: rawContactBook as unknown as ub.ContactBookScryResult1,
      suggestionsResponse: rawSuggestedContacts as string[],
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('isContact');
    expect(result[0]).toHaveProperty('pinnedGroups');
  });
});
