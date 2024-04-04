import {
  MockedFunction,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from 'vitest';

import { scry } from './api/urbit';
import * as db from './db';
import { syncContacts, syncGroups, syncPinnedItems } from './sync';
import rawContactsData from './test/contacts.json';
import rawGroupsData from './test/groups.json';
import { resetDb, setupDb } from './test/helpers';
import { Contact as UrbitContact } from './urbit/contact';
import { Group as UrbitGroup } from './urbit/groups';

const contactsData = rawContactsData as unknown as Record<string, UrbitContact>;
const groupsData = rawGroupsData as unknown as Record<string, UrbitGroup>;

beforeAll(() => {
  setupDb();
});

beforeEach(async () => {
  resetDb();
});

const inputData = [
  '0v4.00000.qd4mk.d4htu.er4b8.eao21',
  '~solfer-magfed',
  '~nibset-napwyn/tlon',
];

const outputData = [
  {
    type: 'club',
    index: 0,
    itemId: inputData[0],
  },
  {
    type: 'dm',
    index: 1,
    itemId: inputData[1],
  },
  {
    type: 'group',
    index: 2,
    itemId: inputData[2],
  },
];

vi.mock('./api/urbit', async () => {
  return {
    scry: vi.fn(),
  };
});

function setScryOutput<T>(output: T) {
  (scry as MockedFunction<() => Promise<T>>).mockImplementationOnce(
    async () => output
  );
}

test('syncs pins', async () => {
  setScryOutput(inputData);
  await syncPinnedItems();
  const savedItems = await db.getPinnedItems({
    orderBy: 'type',
    direction: 'asc',
  });
  expect(savedItems).toEqual(outputData);
});

test('syncs contacts', async () => {
  setScryOutput(contactsData);
  await syncContacts();
  const storedContacts = await db.getContacts();
  expect(storedContacts.length).toEqual(
    Object.values(contactsData).filter((n) => !!n).length
  );
  storedContacts.forEach((c) => {
    const original = contactsData[c.id];
    expect(original).toBeTruthy();
    expect(original.groups?.length ?? 0).toEqual(c.pinnedGroups.length);
  });
  setScryOutput(contactsData);
  await syncContacts();
});

test('sync groups', async () => {
  setScryOutput(groupsData);
  await syncGroups();
  const storedGroups = await db.getGroups();
  expect(storedGroups.length).toEqual(Object.values(groupsData).length);
});
