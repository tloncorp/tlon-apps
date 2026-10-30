import * as api from '@tloncorp/api';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSystemContacts: vi.fn(),
  values: new Map<string, string>(),
}));
vi.mock('../systemContactsApi', () => ({
  getSystemContacts: mocks.getSystemContacts,
}));
vi.mock('../../db/getStorageMethods', () => ({
  getStorageMethods: () => ({
    getItem: async (key: string) => mocks.values.get(key),
    setItem: async (key: string, value: string) => mocks.values.set(key, value),
  }),
}));

import * as db from '../../db';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { setContactsMatchedHandler } from '../lanyardActions';
import { updateInitializedClient } from '../session';
import { syncQueue } from '../syncQueue';
import { syncContactDiscovery } from './sync';

setupDatabaseTestSuite();
const phoneNumber = '+15555550123';
const contactId = '~sampel-palnet';

beforeEach(async () => {
  mocks.values.clear();
  vi.spyOn(db, 'getUserAttestations').mockResolvedValue([
    {
      id: 'phone-attestation',
      contactId: '~solfer-magfed',
      provider: 'test',
      type: 'phone',
      value: 'phone-hash',
      discoverability: 'verified',
      status: 'verified',
      initiatedAt: null,
      statusMessage: null,
      providerUrl: null,
      provingTweetId: null,
      signature: null,
    },
  ]);
  mocks.getSystemContacts.mockResolvedValue([
    { id: 'native-contact', firstName: 'Test', phoneNumber },
  ]);
  vi.spyOn(api, 'discoverContacts').mockResolvedValue({
    matches: [[phoneNumber, contactId]],
    nextSalt: '0vnext',
  });
  vi.spyOn(api, 'getContacts').mockResolvedValue([]);
  vi.spyOn(api, 'addContact').mockResolvedValue(1);
  vi.spyOn(api, 'addUserContacts').mockImplementation((ids) =>
    Promise.all(ids.map((id) => api.addContact(id)))
  );
  vi.spyOn(api, 'updateContactMetadata').mockResolvedValue(1);
  vi.spyOn(api, 'getHiddenContactSuggestions').mockResolvedValue([]);
});
afterEach(() => {
  setContactsMatchedHandler(null);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test('overlapping discovery shares one run and its matches', async () => {
  let finishNotification!: () => void;
  const handler = vi.fn(
    () => new Promise<void>((resolve) => (finishNotification = resolve))
  );
  setContactsMatchedHandler(handler);
  const first = syncContactDiscovery();
  const second = syncContactDiscovery(undefined, { invokeHandler: false });
  await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
  finishNotification();
  expect((await first).newMatches).toEqual([[phoneNumber, contactId]]);
  expect((await second).newMatches).toEqual([[phoneNumber, contactId]]);
  expect(api.discoverContacts).toHaveBeenCalledOnce();
  expect(api.addContact).toHaveBeenCalledOnce();

  await syncContactDiscovery();
  expect(api.discoverContacts).toHaveBeenNthCalledWith(
    2,
    [phoneNumber],
    '0vnext',
    JSON.stringify([phoneNumber])
  );
});

test('a failed request does not advance the proof', async () => {
  vi.mocked(api.discoverContacts).mockRejectedValueOnce(new Error('nacked'));
  expect((await syncContactDiscovery()).didSucceed).toBe(false);
  expect((await syncContactDiscovery()).didSucceed).toBe(true);
  expect(api.discoverContacts).toHaveBeenNthCalledWith(
    2,
    [phoneNumber],
    null,
    null
  );
});

test('a run from a prior login discards its late answer', async () => {
  let answer!: (value: {
    matches: [string, string][];
    nextSalt: string;
  }) => void;
  vi.mocked(api.discoverContacts).mockImplementationOnce(
    () => new Promise((resolve) => (answer = resolve))
  );
  const first = syncContactDiscovery();
  const queued = syncContactDiscovery();
  await vi.waitFor(() => expect(answer).toBeDefined());
  updateInitializedClient(false);
  answer({ matches: [[phoneNumber, contactId]], nextSalt: '0vlate' });
  expect((await first).didSucceed).toBe(false);
  expect((await queued).didSucceed).toBe(false);
  expect(api.discoverContacts).toHaveBeenCalledOnce();
  expect(api.addUserContacts).not.toHaveBeenCalled();
  expect(await db.contactDiscoveryCursor.getValue()).toBeNull();
});

test('a sync-queue delay cannot send an old book through a new login', async () => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => (release = resolve));
  const queued = vi
    .spyOn(syncQueue, 'add')
    .mockImplementation(async (_label, _ctx, action) => {
      await ready;
      return action();
    });
  const request = syncContactDiscovery();
  await vi.waitFor(() => expect(queued).toHaveBeenCalledOnce());
  updateInitializedClient(false);
  release();
  expect((await request).didSucceed).toBe(false);
  expect(api.discoverContacts).not.toHaveBeenCalled();
});
