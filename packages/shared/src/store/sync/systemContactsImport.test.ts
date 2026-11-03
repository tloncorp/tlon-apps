import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  getContactsAsync: vi.fn(),
  discoverContacts: vi.fn(),
}));
vi.mock('expo-contacts/legacy', () => ({
  getPermissionsAsync: mocks.getPermissionsAsync,
  getContactsAsync: mocks.getContactsAsync,
  Fields: { PhoneNumbers: 'phoneNumbers', Emails: 'emails' },
}));
vi.mock('expo-localization', () => ({
  getLocales: () => [{ regionCode: 'US' }],
}));
vi.mock(
  '../systemContactsApi',
  async () => import('../systemContactsApi.native')
);
vi.mock('../lanyardActions', async (original) => ({
  ...(await original<typeof import('../lanyardActions')>()),
  discoverContacts: mocks.discoverContacts,
}));

import * as db from '../../db';
import { getClient, setupDatabaseTestSuite } from '../../test/helpers';
import { getSystemContacts } from '../systemContactsApi.native';
import { syncContactDiscovery, syncSystemContacts } from './sync';

setupDatabaseTestSuite();
beforeEach(() => {
  mocks.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mocks.getContactsAsync.mockResolvedValue({ data: [] });
  mocks.discoverContacts.mockResolvedValue([]);
  vi.spyOn(db, 'getUserAttestations').mockResolvedValue([
    {
      id: 'phone-attestation',
      contactId: '~solfer-magfed',
      provider: 'test',
      type: 'phone',
      value: 'phone-hash',
      discoverability: 'public',
      status: 'verified',
      initiatedAt: null,
      statusMessage: null,
      providerUrl: null,
      provingTweetId: null,
      signature: null,
    },
  ]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function failNativeRead(stage: 'permission' | 'read' | 'parse') {
  if (stage === 'permission') {
    mocks.getPermissionsAsync.mockRejectedValue(new Error('OS unavailable'));
  } else if (stage === 'read') {
    mocks.getContactsAsync.mockRejectedValue(new Error('read failed'));
  } else {
    mocks.getContactsAsync.mockResolvedValue({
      data: [{ id: 'bad-row', firstName: 'Test', phoneNumbers: { length: 1 } }],
    });
  }
}

test.each(['permission', 'read', 'parse'] as const)(
  'a native %s error rejects import and reports failed discovery',
  async (stage) => {
    failNativeRead(stage);
    const onSuccess = vi.fn();
    await expect(syncSystemContacts().then(onSuccess)).rejects.toThrow();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(await syncContactDiscovery()).toEqual({
      didSucceed: false,
      didDiscover: false,
      newMatches: [],
    });
    expect(mocks.discoverContacts).not.toHaveBeenCalled();
  }
);

test.each(['denied', 'undetermined'])(
  '%s permission remains a successful no-op',
  async (status) => {
    mocks.getPermissionsAsync.mockResolvedValue({ status });
    expect(await syncSystemContacts()).toEqual([]);
    expect(await syncContactDiscovery()).toEqual({
      didSucceed: true,
      didDiscover: false,
      newMatches: [],
    });
    expect(mocks.getContactsAsync).not.toHaveBeenCalled();
    expect(mocks.discoverContacts).not.toHaveBeenCalled();
  }
);

test('a genuinely empty native book remains a successful no-op', async () => {
  expect(await getSystemContacts()).toEqual([]);
  expect(await syncSystemContacts()).toEqual([]);
  expect(await syncContactDiscovery()).toEqual({
    didSucceed: true,
    didDiscover: false,
    newMatches: [],
  });
});

test('web remains a successful no-op', async () => {
  const web = await vi.importActual<typeof import('../systemContactsApi')>(
    '../systemContactsApi'
  );
  expect(await web.getSystemContacts()).toEqual([]);
  expect(mocks.getPermissionsAsync).not.toHaveBeenCalled();
});

test('a normalized native book imports and an accepted zero-match lookup succeeds', async () => {
  mocks.getContactsAsync.mockResolvedValue({
    data: [
      {
        id: 'test-contact',
        firstName: 'Test',
        phoneNumbers: [{ number: '2025550123', digits: '2025550123' }],
      },
    ],
  });
  expect(await syncSystemContacts()).toEqual([
    expect.objectContaining({ phoneNumber: '+12025550123' }),
  ]);
  expect(await db.getSystemContacts()).toEqual([
    expect.objectContaining({ phoneNumber: '+12025550123', firstName: 'Test' }),
  ]);
  expect(await syncContactDiscovery()).toEqual({
    didSucceed: true,
    didDiscover: true,
    newMatches: [],
  });
  expect(mocks.discoverContacts).toHaveBeenCalledWith(['+12025550123']);
});

test('a later SQL batch failure rejects import and rolls back earlier batches', async () => {
  await db.insertSystemContacts({
    systemContacts: [{ id: 'prior', firstName: 'Original', contactId: '~zod' }],
  });
  await getClient()!.run(sql`
    CREATE TRIGGER reject_system_contact BEFORE INSERT ON system_contacts
    WHEN NEW.id = 'contact-200'
    BEGIN SELECT RAISE(ABORT, 'import failed'); END
  `);
  mocks.getContactsAsync.mockResolvedValue({
    data: Array.from({ length: 201 }, (_, index) => ({
      id: index === 0 ? 'prior' : `contact-${index}`,
      firstName: 'Replacement',
      phoneNumbers: [{ number: '+12025550123', digits: '+12025550123' }],
    })),
  });
  const onSuccess = vi.fn();
  await expect(syncSystemContacts().then(onSuccess)).rejects.toThrow(
    'import failed'
  );
  expect(onSuccess).not.toHaveBeenCalled();
  expect(await db.getSystemContacts()).toEqual([
    expect.objectContaining({
      id: 'prior',
      firstName: 'Original',
      contactId: '~zod',
    }),
  ]);

  await getClient()!.run(sql`DROP TRIGGER reject_system_contact`);
  expect(await syncSystemContacts()).toHaveLength(201);
  const imported = await db.getSystemContacts();
  expect(imported).toHaveLength(201);
  expect(imported.find((contact) => contact.id === 'prior')).toMatchObject({
    firstName: 'Replacement',
    contactId: '~zod',
  });
});
