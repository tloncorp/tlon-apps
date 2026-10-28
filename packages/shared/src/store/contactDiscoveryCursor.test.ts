import * as api from '@tloncorp/api';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  setItem: vi.fn(),
}));
vi.mock('../db/getStorageMethods', () => ({
  getStorageMethods: () => ({
    getItem: async (key: string) => storage.values.get(key),
    setItem: storage.setItem,
  }),
}));

import * as db from '../db';
import { discoverContacts } from './lanyardActions';
import { updateInitializedClient } from './session';

const previous = { salt: '0vold', phoneNumbers: ['+15555550100'] };
const phones = ['+15555550100', '+15555550101'];

beforeEach(async () => {
  storage.values.clear();
  storage.setItem.mockReset().mockImplementation(async (key, value) => {
    storage.values.set(key, value);
  });
  vi.spyOn(api, 'discoverContacts').mockResolvedValue({
    matches: [],
    nextSalt: '0vnext',
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

test('an accepted empty response advances the salt and book in one write', async () => {
  await db.contactDiscoveryCursor.setValue(previous);
  storage.setItem.mockClear();
  expect(await discoverContacts(phones)).toEqual([]);
  expect(api.discoverContacts).toHaveBeenCalledWith(
    phones,
    previous.salt,
    JSON.stringify(previous.phoneNumbers)
  );
  expect(storage.setItem.mock.calls).toEqual([
    [
      'contactDiscoveryCursor',
      JSON.stringify({ salt: '0vnext', phoneNumbers: phones }),
    ],
  ]);
});

test.each(['rejected', 'rate limited'] as const)(
  '%s discovery preserves the last accepted cursor',
  async (failure) => {
    await db.contactDiscoveryCursor.setValue(previous);
    vi.mocked(api.discoverContacts).mockRejectedValueOnce(
      new Error(failure === 'rejected' ? 'nacked' : 'rate limited')
    );
    await expect(discoverContacts(phones)).rejects.toThrow();
    expect(await db.contactDiscoveryCursor.getValue()).toEqual(previous);
    await discoverContacts(phones);
    expect(api.discoverContacts).toHaveBeenLastCalledWith(
      phones,
      previous.salt,
      JSON.stringify(previous.phoneNumbers)
    );
  }
);

test('a failed cursor write leaves both parts at the previous accepted value', async () => {
  await db.contactDiscoveryCursor.setValue(previous);
  storage.setItem.mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(discoverContacts(phones)).rejects.toThrow('disk unavailable');
  expect(await db.contactDiscoveryCursor.getValue()).toEqual(previous);
});

test('upgrades the legacy salt/book pair after an accepted response', async () => {
  await db.lastLanyardSalt.setValue(previous.salt);
  await db.lastPhoneContactSetRequest.setValue(
    JSON.stringify(previous.phoneNumbers)
  );
  await discoverContacts(phones);
  expect(api.discoverContacts).toHaveBeenCalledWith(
    phones,
    previous.salt,
    JSON.stringify(previous.phoneNumbers)
  );
  expect(await db.contactDiscoveryCursor.getValue()).toEqual({
    salt: '0vnext',
    phoneNumbers: phones,
  });
});

test('an answer from a previous login cannot advance the current cursor', async () => {
  await db.contactDiscoveryCursor.setValue(previous);
  let answer!: (value: { matches: []; nextSalt: string }) => void;
  vi.mocked(api.discoverContacts).mockImplementationOnce(
    () => new Promise((resolve) => (answer = resolve))
  );
  const request = discoverContacts(phones);
  const rejected = expect(request).rejects.toThrow('session changed');
  await vi.waitFor(() => expect(answer).toBeDefined());
  updateInitializedClient(false);
  answer({ matches: [], nextSalt: '0vlate' });
  await rejected;
  expect(await db.contactDiscoveryCursor.getValue()).toEqual(previous);
});
