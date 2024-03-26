import {
  beforeEach,
  beforeAll,
  expect,
  test,
  vi,
  MockedFunction,
} from "vitest";
import { syncContacts, syncPinnedItems } from "./sync";
import { setupDb, resetDb } from "./test/testHelpers";
import { scry } from "./api/urbit";
import { Contact as UrbitContact } from "./urbit/contact";
import * as db from "./db";
import rawContactsData from "./test/contacts.json";

const contactsData = rawContactsData as unknown as Record<string, UrbitContact>;

beforeAll(() => {
  setupDb();
});

beforeEach(async () => {
  resetDb();
});

const inputData = [
  "0v4.00000.qd4mk.d4htu.er4b8.eao21",
  "~solfer-magfed",
  "~nibset-napwyn/tlon",
];

const outputData = [
  {
    type: "club",
    itemId: inputData[0],
  },
  {
    type: "dm",
    itemId: inputData[1],
  },
  {
    type: "group",
    itemId: inputData[2],
  },
];

vi.mock("./api/urbit", async () => {
  return {
    scry: vi.fn(),
  };
});

function setScryOutput<T>(output: T) {
  (scry as MockedFunction<() => Promise<T>>).mockImplementationOnce(
    async () => output
  );
}

test("syncs pins", async () => {
  setScryOutput(inputData);
  await syncPinnedItems();
  const savedItems = await db.getPinnedItems({
    orderBy: "type",
    direction: "asc",
  });
  expect(savedItems).toEqual(outputData);
});

test("syncs contacts", async () => {
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
});
