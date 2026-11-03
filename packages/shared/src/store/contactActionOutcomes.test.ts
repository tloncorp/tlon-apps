import * as api from '@tloncorp/api';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSystemContacts: vi.fn() }));
vi.mock('./systemContactsApi', () => ({
  getSystemContacts: mocks.getSystemContacts,
}));

import * as db from '../db';
import { setupDatabaseTestSuite } from '../test/helpers';
import { addContacts, updateContactMetadata } from './contactActions';
import { setContactsMatchedHandler } from './lanyardActions';
import { syncContactDiscovery } from './sync/sync';

setupDatabaseTestSuite();

const acceptedId = '~sampel-palnet';
const failedId = '~zod';
const firstPhone = '+15555550123';
const secondPhone = '+15555550124';
const systemContacts = [
  { id: 'first', firstName: 'Accepted', lastName: '', phoneNumber: firstPhone },
  { id: 'second', firstName: 'Retry', lastName: '', phoneNumber: secondPhone },
];
const matches: [string, string][] = [
  [firstPhone, acceptedId],
  [secondPhone, failedId],
];
const onMatches = vi.fn();

beforeEach(async () => {
  vi.spyOn(api, 'getContacts').mockResolvedValue([]);
  vi.spyOn(api, 'addContact').mockResolvedValue(1);
  vi.spyOn(api, 'addUserContacts').mockImplementation((ids) =>
    Promise.all(ids.map((id) => api.addContact(id)))
  );
  vi.spyOn(api, 'updateContactMetadata').mockResolvedValue(1);
  vi.spyOn(api, 'discoverContacts').mockResolvedValue({
    matches,
    nextSalt: '0x1',
  });
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
  mocks.getSystemContacts.mockResolvedValue(systemContacts);
  onMatches.mockReset();
  setContactsMatchedHandler(onMatches);
  await db.insertSystemContacts({ systemContacts });
});

afterEach(() => {
  setContactsMatchedHandler(null);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test('bulk add preserves accepted contacts and restores only failed snapshots', async () => {
  await db.upsertContact({ id: failedId, isContactSuggestion: true });
  vi.mocked(api.addContact).mockImplementation(async (id) => {
    if (id === failedId) throw new Error('page nacked');
    return 1;
  });
  expect(await addContacts([acceptedId, failedId])).toEqual({
    addedContactIds: [acceptedId],
    failedContactIds: [failedId],
  });
  expect(await db.getContact({ id: acceptedId })).toMatchObject({
    isContact: true,
    isContactSuggestion: false,
  });
  expect(await db.getContact({ id: failedId })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
});

test('failed preflight returns failure and restores existing contact flags', async () => {
  await db.upsertContact({ id: acceptedId, isContact: true });
  await db.upsertContact({ id: failedId, isContactSuggestion: true });
  vi.mocked(api.getContacts).mockRejectedValueOnce(new Error('offline'));
  expect(await addContacts([acceptedId, failedId])).toEqual({
    addedContactIds: [],
    failedContactIds: [acceptedId, failedId],
  });
  expect(await db.getContact({ id: acceptedId })).toMatchObject({
    isContact: true,
  });
  expect(await db.getContact({ id: failedId })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
  expect(api.addContact).not.toHaveBeenCalled();
});

test('contacts already accepted by the ship need no duplicate add', async () => {
  vi.mocked(api.getContacts).mockResolvedValue([
    { id: acceptedId, isContact: true },
  ]);
  expect(await addContacts([acceptedId])).toEqual({
    addedContactIds: [acceptedId],
    failedContactIds: [],
  });
  expect(api.addContact).not.toHaveBeenCalled();
});

test('failed metadata returns false and restores both overrides', async () => {
  await db.upsertContact({
    id: acceptedId,
    isContact: true,
    customNickname: 'Chosen',
    customAvatarImage: 'https://example.com/original.png',
  });
  vi.mocked(api.updateContactMetadata).mockRejectedValueOnce(
    new Error('nacked')
  );
  expect(
    await updateContactMetadata(acceptedId, {
      nickname: 'Changed',
      avatarImage: null,
    })
  ).toBe(false);
  expect(await db.getContact({ id: acceptedId })).toMatchObject({
    isContact: true,
    customNickname: 'Chosen',
    customAvatarImage: 'https://example.com/original.png',
  });
  expect(await updateContactMetadata(acceptedId, { nickname: 'Changed' })).toBe(
    true
  );
});

test('discovery marks and announces only accepted matches and retries failed adds', async () => {
  vi.mocked(api.addContact).mockImplementation(async (id) => {
    if (id === failedId) throw new Error('page nacked');
    return 1;
  });
  expect(await syncContactDiscovery()).toEqual({
    didDiscover: true,
    didSucceed: false,
    newMatches: [matches[0]],
  });
  expect(await db.getContact({ id: acceptedId })).toMatchObject({
    isContact: true,
    matchedAt: expect.any(Number),
  });
  expect(await db.getContact({ id: failedId })).toMatchObject({
    isContact: false,
    matchedAt: null,
    customNickname: null,
  });
  expect(api.updateContactMetadata).toHaveBeenCalledTimes(1);
  expect(onMatches).toHaveBeenCalledTimes(1);
  expect(onMatches).toHaveBeenCalledWith([acceptedId]);

  vi.mocked(api.addContact).mockResolvedValue(1);
  expect(await syncContactDiscovery()).toEqual({
    didDiscover: true,
    didSucceed: true,
    newMatches: [matches[1]],
  });
  expect(await db.getContact({ id: failedId })).toMatchObject({
    isContact: true,
    matchedAt: expect.any(Number),
  });
  expect(onMatches).toHaveBeenLastCalledWith([failedId]);
});

test('complete add failure returns no matches and sends no notification', async () => {
  vi.mocked(api.addContact).mockRejectedValue(new Error('offline'));
  expect(await syncContactDiscovery()).toEqual({
    didDiscover: true,
    didSucceed: false,
    newMatches: [],
  });
  expect(onMatches).not.toHaveBeenCalled();
  expect(api.updateContactMetadata).not.toHaveBeenCalled();
  expect(await db.getContact({ id: acceptedId })).toMatchObject({
    isContact: false,
    matchedAt: null,
  });
});

test('metadata failure reports failed discovery without undoing accepted adds', async () => {
  vi.mocked(api.updateContactMetadata).mockRejectedValue(
    new Error('edit nacked')
  );
  expect(await syncContactDiscovery()).toEqual({
    didDiscover: true,
    didSucceed: false,
    newMatches: matches,
  });
  expect(await db.getContact({ id: acceptedId })).toMatchObject({
    isContact: true,
    matchedAt: expect.any(Number),
    customNickname: null,
  });
  expect(onMatches).toHaveBeenCalledTimes(1);
  expect(onMatches).toHaveBeenCalledWith([acceptedId, failedId]);
});

test('repeated contact IDs are added once rather than creating a false partial failure', async () => {
  expect(await addContacts([acceptedId, acceptedId])).toEqual({
    addedContactIds: [acceptedId],
    failedContactIds: [],
  });
  expect(api.addContact).toHaveBeenCalledTimes(1);
});
