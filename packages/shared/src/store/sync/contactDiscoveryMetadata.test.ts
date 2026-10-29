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
  vi.spyOn(api, 'getContacts').mockResolvedValue([]);
  vi.spyOn(api, 'addContact').mockResolvedValue(1);
  vi.spyOn(api, 'updateContactMetadata').mockResolvedValue(1);
  await db.insertSystemContacts({ systemContacts: [systemContact] });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test.each(['Chosen nickname', null])(
  'a saved contact uses the address-book name over its nickname (%s)',
  async (customNickname) => {
    await db.upsertContact({
      id: contactId,
      isContact: true,
      peerNickname: 'Peer name',
      customAvatarImage: 'saved-avatar',
      customNickname,
    });

    expect(
      await syncContactDiscovery(undefined, { invokeHandler: false })
    ).toEqual({ didSucceed: true, didDiscover: true, newMatches: [] });

    const contact = await db.getContact({ id: contactId });
    expect(contact?.customNickname).toBe('Address Book');
    expect(contact?.nickname).toBe('Address Book');
    expect(contact?.customAvatarImage).toBe('saved-avatar');
    expect(contact?.isContact).toBe(true);
    expect(await db.getSystemContactsBatchByContactId([contactId])).toEqual([
      expect.objectContaining({ id: systemContact.id, contactId }),
    ]);
    expect(api.addContact).not.toHaveBeenCalled();
    expect(api.updateContactMetadata).toHaveBeenCalledWith(contactId, {
      nickname: 'Address Book',
      avatarImage: undefined,
    });
  }
);

test.each(['absent', 'skeletal'])(
  'a new match with an initially %s contact persists its address-book name',
  async (initialState) => {
    if (initialState === 'skeletal') {
      await db.upsertContact({ id: contactId, isContact: false });
    }

    expect(
      await syncContactDiscovery(undefined, { invokeHandler: false })
    ).toEqual({
      didSucceed: true,
      didDiscover: true,
      newMatches: [[phoneNumber, contactId]],
    });

    expect(api.addContact).toHaveBeenCalledWith(contactId);
    expect(api.updateContactMetadata).toHaveBeenCalledWith(contactId, {
      nickname: 'Address Book',
      avatarImage: undefined,
    });
    expect(await db.getContact({ id: contactId })).toEqual(
      expect.objectContaining({
        isContact: true,
        customNickname: 'Address Book',
      })
    );
  }
);

test.each([false, true])(
  'a known unsaved contact gets the book name without saving (suggestion: %s)',
  async (isContactSuggestion) => {
    await db.upsertContact({
      id: contactId,
      isContact: false,
      isContactSuggestion,
      peerNickname: 'Peer name',
      customNickname: 'Chosen name',
      customAvatarImage: 'avatar',
    });
    expect(
      await syncContactDiscovery(undefined, { invokeHandler: false })
    ).toEqual({
      didSucceed: true,
      didDiscover: true,
      newMatches: [],
    });
    expect(await db.getContact({ id: contactId })).toEqual(
      expect.objectContaining({
        isContact: false,
        isContactSuggestion,
        customNickname: 'Address Book',
        customAvatarImage: 'avatar',
      })
    );
    expect(api.addContact).not.toHaveBeenCalled();
    expect(api.updateContactMetadata).not.toHaveBeenCalled();
  }
);

test('an empty address-book name leaves the existing name intact', async () => {
  await db.insertSystemContacts({
    systemContacts: [{ ...systemContact, firstName: '', lastName: '' }],
  });
  await db.upsertContact({
    id: contactId,
    isContact: true,
    customNickname: 'Chosen name',
  });
  await syncContactDiscovery(undefined, { invokeHandler: false });
  expect((await db.getContact({ id: contactId }))?.customNickname).toBe(
    'Chosen name'
  );
  expect(api.updateContactMetadata).not.toHaveBeenCalled();
});

test('a failed skeletal add retries on rediscovery and persists the book name', async () => {
  await db.upsertContact({ id: contactId, isContact: false });
  vi.mocked(api.addContact).mockRejectedValueOnce(new Error('offline'));
  expect(
    await syncContactDiscovery(undefined, { invokeHandler: false })
  ).toEqual({
    didSucceed: false,
    didDiscover: true,
    newMatches: [],
  });
  expect((await db.getContact({ id: contactId }))?.customNickname).toBeNull();
  expect(api.updateContactMetadata).not.toHaveBeenCalled();
  expect(
    await syncContactDiscovery(undefined, { invokeHandler: false })
  ).toEqual({
    didSucceed: true,
    didDiscover: true,
    newMatches: [[phoneNumber, contactId]],
  });
  expect(api.addContact).toHaveBeenCalledTimes(2);
  expect((await db.getContact({ id: contactId }))?.customNickname).toBe(
    'Address Book'
  );
});

test('a metadata failure rolls back and rediscovery retries the book name', async () => {
  await db.upsertContact({
    id: contactId,
    isContact: true,
    customNickname: 'Chosen name',
  });
  vi.mocked(api.updateContactMetadata).mockRejectedValueOnce(
    new Error('offline')
  );
  expect(
    await syncContactDiscovery(undefined, { invokeHandler: false })
  ).toEqual({
    didSucceed: false,
    didDiscover: true,
    newMatches: [],
  });
  expect((await db.getContact({ id: contactId }))?.customNickname).toBe(
    'Chosen name'
  );
  expect(
    await syncContactDiscovery(undefined, { invokeHandler: false })
  ).toEqual({
    didSucceed: true,
    didDiscover: true,
    newMatches: [],
  });
  expect(api.updateContactMetadata).toHaveBeenCalledTimes(2);
  expect((await db.getContact({ id: contactId }))?.customNickname).toBe(
    'Address Book'
  );
  await syncContactDiscovery(undefined, { invokeHandler: false });
  expect(api.updateContactMetadata).toHaveBeenCalledTimes(2);
});

test.each(['Address Book', 'Internal name'])(
  'multiple native cards choose one stable name when the current name is %s',
  async (customNickname) => {
    const secondCard = {
      ...systemContact,
      id: 'second-native-contact',
      firstName: 'Address',
      lastName: 'Work',
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
    await db.upsertContact({ id: contactId, isContact: true, customNickname });

    for (let run = 0; run < 2; run++) {
      expect(
        await syncContactDiscovery(undefined, { invokeHandler: false })
      ).toEqual({
        didSucceed: true,
        didDiscover: true,
        newMatches: [],
      });
      expect((await db.getContact({ id: contactId }))?.customNickname).toBe(
        'Address Book'
      );
    }
    expect(api.updateContactMetadata).toHaveBeenCalledTimes(
      customNickname === 'Address Book' ? 0 : 1
    );
  }
);

test('an unnamed first native card does not hide a later named card', async () => {
  const unnamedCard = { ...systemContact, firstName: '', lastName: '' };
  const namedCard = {
    ...systemContact,
    id: 'second-native-contact',
    phoneNumber: '+15555550456',
  };
  await db.insertSystemContacts({ systemContacts: [unnamedCard, namedCard] });
  mocks.getSystemContacts.mockResolvedValue([unnamedCard, namedCard]);
  vi.mocked(api.discoverContacts).mockResolvedValue({
    matches: [
      [phoneNumber, contactId],
      [namedCard.phoneNumber, contactId],
    ],
    nextSalt: '0x1',
  });
  await db.upsertContact({
    id: contactId,
    isContact: true,
    customNickname: 'Internal name',
  });
  await syncContactDiscovery(undefined, { invokeHandler: false });
  await syncContactDiscovery(undefined, { invokeHandler: false });
  expect((await db.getContact({ id: contactId }))?.customNickname).toBe(
    'Address Book'
  );
  expect(api.updateContactMetadata).toHaveBeenCalledTimes(1);
});
