import * as api from '@tloncorp/api';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSystemContacts: vi.fn() }));
vi.mock('../systemContactsApi', () => ({
  getSystemContacts: mocks.getSystemContacts,
}));

import * as db from '../../db';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { syncContactDiscovery } from './sync';

setupDatabaseTestSuite();

const phoneNumber = '+15555550123';
const contactId = '~zod';
const systemContact = {
  id: 'native-contact',
  firstName: 'Address',
  lastName: 'Book',
  phoneNumber,
};

beforeEach(async () => {
  vi.spyOn(db, 'getUserAttestations').mockResolvedValue([
    {
      id: 'phone-attestation',
      contactId: '~solfer-magfed',
      provider: 'test',
      type: 'phone',
      value: '+15555550000',
      discoverability: 'verified',
      status: 'verified',
      initiatedAt: null,
      statusMessage: null,
      providerUrl: null,
      provingTweetId: null,
      signature: null,
    },
  ]);
  mocks.getSystemContacts.mockResolvedValue([systemContact]);
  vi.spyOn(api, 'discoverContacts').mockResolvedValue({
    matches: [[phoneNumber, contactId]],
    nextSalt: '0x1',
  });
  vi.spyOn(api, 'getDiscoveryKnownContacts').mockResolvedValue([]);
  vi.spyOn(api, 'recordDiscoveredContacts').mockResolvedValue(1);
  vi.spyOn(api, 'addContact').mockResolvedValue(1);
  vi.spyOn(api, 'updateContactMetadata').mockResolvedValue(1);
  await db.insertSystemContacts({ systemContacts: [systemContact] });
  api.setDeskSupportsContactDiscovery(true);
});

afterEach(() => {
  api.setDeskSupportsContactDiscovery(null);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const discover = () =>
  syncContactDiscovery(undefined, { invokeHandler: false });

test('the ship saves a new match under its address-book name', async () => {
  // A cached profile is not a relationship.
  await db.upsertContact({
    id: contactId,
    isContact: false,
    peerNickname: 'Peer name',
    bio: 'bio',
  });

  expect(await discover()).toEqual({
    didSucceed: true,
    didDiscover: true,
    newMatches: [[phoneNumber, contactId]],
  });
  expect(api.recordDiscoveredContacts).toHaveBeenCalledWith([
    { ship: contactId, nickname: 'Address Book' },
  ]);
  expect(api.addContact).not.toHaveBeenCalled();
  expect(api.updateContactMetadata).not.toHaveBeenCalled();
  expect(await db.getContact({ id: contactId })).toEqual(
    expect.objectContaining({
      isContact: true,
      customNickname: 'Address Book',
    })
  );
});

test('a name the user already gave a match outranks the book name', async () => {
  await db.upsertContact({
    id: contactId,
    isContact: false,
    customNickname: 'Chosen name',
  });

  await discover();

  expect(api.recordDiscoveredContacts).toHaveBeenCalledWith([
    { ship: contactId, nickname: 'Chosen name' },
  ]);
});

test('a match the ship already knows is not announced', async () => {
  vi.mocked(api.getDiscoveryKnownContacts).mockResolvedValue([contactId]);

  expect(await discover()).toEqual({
    didSucceed: true,
    didDiscover: true,
    newMatches: [],
  });
  expect(api.recordDiscoveredContacts).not.toHaveBeenCalled();
});

test('one account matched by several cards is recorded once', async () => {
  const secondCard = {
    ...systemContact,
    id: 'second-native-contact',
    phoneNumber: '+15555550456',
  };
  await db.insertSystemContacts({ systemContacts: [secondCard] });
  mocks.getSystemContacts.mockResolvedValue([systemContact, secondCard]);
  vi.mocked(api.discoverContacts).mockResolvedValue({
    matches: [
      [phoneNumber, contactId],
      [secondCard.phoneNumber, contactId],
    ],
    nextSalt: '0x1',
  });

  await discover();

  expect(api.recordDiscoveredContacts).toHaveBeenCalledWith([
    { ship: contactId, nickname: 'Address Book' },
  ]);
});

test('a failed record announces nothing and saves nothing locally', async () => {
  vi.mocked(api.recordDiscoveredContacts).mockRejectedValue(
    new Error('offline')
  );

  expect(await discover()).toEqual({
    didSucceed: false,
    didDiscover: true,
    newMatches: [],
  });
  expect((await db.getContact({ id: contactId }))?.isContact).not.toBe(true);
});
