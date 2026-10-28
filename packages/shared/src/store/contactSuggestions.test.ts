import { poke, scry } from '@tloncorp/api';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import * as db from '../db';
import {
  resetDb,
  setScryOutputs,
  setupDatabaseTestSuite,
} from '../test/helpers';
import * as LocalCache from './cachedData';
import {
  addContact,
  addContactSuggestions,
  removeContact,
} from './contactActions';
import { handleContactUpdate } from './sync/sync';
import { syncContacts } from './sync/syncContacts';

setupDatabaseTestSuite();

const declinedId = '~nec';
const removedId = '~bud';
const newId = '~zod';
const contactIds = [declinedId, removedId, newId];
const directory = Object.fromEntries(
  contactIds.map((id) => [
    id,
    { contact: { nickname: { type: 'text', value: id } } },
  ])
);

beforeEach(async () => {
  vi.mocked(poke).mockResolvedValue(1);
  await db.insertContacts(
    contactIds.map((id) => ({
      id,
      isContact: false,
      isContactSuggestion: false,
    }))
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test('shows only server-accepted suggestions after the add is acknowledged', async () => {
  let acknowledge!: () => void;
  let started!: () => void;
  const acknowledged = new Promise<void>((resolve) => {
    acknowledge = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.mocked(poke).mockImplementationOnce(async () => {
    started();
    await acknowledged;
    return 1;
  });
  setScryOutputs([directory, {}, [newId]]);

  const adding = addContactSuggestions(contactIds);
  await requestStarted;
  expect(await db.getSuggestedContacts()).toEqual([]);
  expect(scry).not.toHaveBeenCalled();
  acknowledge();
  await adding;

  expect((await db.getSuggestedContacts()).map((c) => c.id)).toEqual([newId]);
  expect((await db.getContact({ id: declinedId }))?.isContactSuggestion).toBe(
    false
  );
  expect((await db.getContact({ id: removedId }))?.isContactSuggestion).toBe(
    false
  );
  expect(poke).toHaveBeenCalledTimes(1);
  expect(poke).toHaveBeenCalledWith({
    app: 'groups-ui',
    mark: 'ui-add-contact-suggestions',
    json: contactIds,
  });

  resetDb();
  setScryOutputs([directory, {}, [newId]]);
  await syncContacts();
  expect((await db.getSuggestedContacts()).map((c) => c.id)).toEqual([newId]);
});

test('a rejected add leaves local suggestion flags unchanged', async () => {
  await db.updateContact({ id: removedId, isContactSuggestion: true });
  vi.mocked(poke).mockRejectedValueOnce(new Error('add rejected'));

  await addContactSuggestions(contactIds);

  expect((await db.getSuggestedContacts()).map((c) => c.id)).toEqual([
    removedId,
  ]);
  expect(scry).not.toHaveBeenCalled();
});

test('a failed authoritative refresh does not display unconfirmed suggestions', async () => {
  vi.mocked(scry).mockRejectedValueOnce(new Error('refresh failed'));

  await addContactSuggestions(contactIds);

  expect(await db.getSuggestedContacts()).toEqual([]);
  expect(poke).toHaveBeenCalledOnce();
});

test('a contact added during the fetch remains suppressed after a later removal', async () => {
  const cacheContacts = vi.spyOn(LocalCache, 'cacheContacts');
  let respond!: (value: string[]) => void;
  let started!: () => void;
  const response = new Promise<string[]>((resolve) => {
    respond = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.mocked(scry)
    .mockResolvedValueOnce(directory)
    .mockResolvedValueOnce({})
    .mockImplementationOnce(async () => {
      started();
      return response;
    });

  const adding = addContactSuggestions([newId]);
  await requestStarted;
  await addContact(newId);
  await handleContactUpdate({
    type: 'upsertContact',
    contact: { id: newId, isContact: true, isContactSuggestion: false },
  });
  await db.updateContact({
    id: newId,
    customNickname: 'Chosen name',
  });
  expect(poke).toHaveBeenCalledWith({
    app: 'groups-ui',
    mark: 'ui-hide-contact',
    json: newId,
  });
  respond([newId]);
  await adding;

  expect(await db.getContact({ id: newId })).toMatchObject({
    isContact: true,
    isContactSuggestion: false,
    customNickname: 'Chosen name',
  });
  expect(await db.getSuggestedContacts()).toEqual([]);
  expect(cacheContacts).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        id: newId,
        isContact: true,
        isContactSuggestion: false,
        customNickname: 'Chosen name',
      }),
    ])
  );
  await removeContact(newId);
  await handleContactUpdate({ type: 'removeContact', contactId: newId });
  expect(await db.getContact({ id: newId })).toMatchObject({
    isContact: false,
    isContactSuggestion: false,
  });
  expect(await db.getSuggestedContacts()).toEqual([]);
});
