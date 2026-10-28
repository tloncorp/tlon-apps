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
  vi.spyOn(api, 'addUserContacts').mockResolvedValue([]);
  vi.spyOn(api, 'updateContactMetadata').mockResolvedValue(1);
  await db.insertSystemContacts({ systemContacts: [systemContact] });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test.each(['Chosen nickname', null])(
  'linking a known contact preserves its custom nickname (%s)',
  async (customNickname) => {
    await db.upsertContact({
      id: contactId,
      isContact: true,
      peerNickname: 'Peer name',
      customNickname,
    });

    expect(
      await syncContactDiscovery(undefined, { invokeHandler: false })
    ).toEqual({ didSucceed: true, didDiscover: true, newMatches: [] });

    const contact = await db.getContact({ id: contactId });
    expect(contact?.customNickname).toBe(customNickname);
    expect(contact?.nickname).toBe(customNickname ?? 'Peer name');
    expect(contact?.isContact).toBe(true);
    expect(await db.getSystemContactsBatchByContactId([contactId])).toEqual([
      expect.objectContaining({ id: systemContact.id, contactId }),
    ]);
    expect(api.addUserContacts).not.toHaveBeenCalled();
    expect(api.updateContactMetadata).not.toHaveBeenCalled();
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

    expect(api.addUserContacts).toHaveBeenCalledWith([contactId]);
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
