import { expect, test } from 'vitest';

import {
  directoryToClientProfiles,
  v0PeerToClientProfile,
  v0PeersToClientProfiles,
} from '../client/contactsApi';

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

test('omits book entries from directory profiles', () => {
  const profiles = directoryToClientProfiles(directoryResponse, {
    userIdsToOmit: new Set(['~nocsyx-lassul']),
  });
  expect(profiles.map((p) => p.id)).toStrictEqual(['~ravmel-ropdyl']);
});
