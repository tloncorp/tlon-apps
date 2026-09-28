import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  discoverContacts: vi.fn(),
  getSystemContacts: vi.fn(),
  partitionDiscoveryMatches: vi.fn(),
  addContacts: vi.fn(),
  updateContactMetadata: vi.fn(),
}));
vi.mock('../systemContactsApi', () => ({
  getSystemContacts: mocks.getSystemContacts,
}));
vi.mock('../lanyardActions', async (original) => ({
  ...(await original<typeof import('../lanyardActions')>()),
  discoverContacts: mocks.discoverContacts,
  partitionDiscoveryMatches: mocks.partitionDiscoveryMatches,
}));
vi.mock('../contactActions', async (original) => ({
  ...(await original<typeof import('../contactActions')>()),
  addContacts: mocks.addContacts,
  updateContactMetadata: mocks.updateContactMetadata,
}));

import * as db from '../../db';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { syncContactDiscovery } from './sync';

setupDatabaseTestSuite();
beforeEach(() => {
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
  mocks.getSystemContacts.mockResolvedValue([{ phoneNumber: '+15555550123' }]);
  mocks.discoverContacts.mockResolvedValue([]);
  mocks.partitionDiscoveryMatches.mockResolvedValue({ newMatches: [] });
  mocks.addContacts.mockResolvedValue(undefined);
  mocks.updateContactMetadata.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test('a successful discovery with no matches succeeds', async () => {
  expect(await syncContactDiscovery()).toEqual({
    didSucceed: true,
    didDiscover: true,
    newMatches: [],
  });
});

test('no phone attestation skips discovery without failing', async () => {
  vi.mocked(db.getUserAttestations).mockResolvedValue([]);
  expect(await syncContactDiscovery()).toEqual({
    didSucceed: true,
    didDiscover: false,
    newMatches: [],
  });
  expect(mocks.discoverContacts).not.toHaveBeenCalled();
});

test('a rejected discovery request is a failure, not an empty success', async () => {
  mocks.discoverContacts.mockRejectedValueOnce(new Error('client unavailable'));
  expect(await syncContactDiscovery()).toEqual({
    didSucceed: false,
    didDiscover: false,
    newMatches: [],
  });
});

test.each(['link', 'add', 'mark', 'metadata'] as const)(
  'retains a %s failure after discovery succeeds',
  async (stage) => {
    const matches = [['phone-hash', '~zod']];
    mocks.discoverContacts.mockResolvedValue(matches);
    mocks.partitionDiscoveryMatches.mockResolvedValue({ newMatches: matches });
    vi.spyOn(db, 'linkSystemContacts').mockResolvedValue(undefined);
    vi.spyOn(db, 'markContactsAsMatched').mockResolvedValue(undefined);
    vi.spyOn(db, 'getUnnamedSystemContactsByContactId').mockResolvedValue([
      { contactId: '~zod', firstName: 'Test', lastName: '' },
    ]);
    const error = new Error('persist failed');
    if (stage === 'link')
      vi.mocked(db.linkSystemContacts).mockRejectedValueOnce(error);
    if (stage === 'add') mocks.addContacts.mockRejectedValueOnce(error);
    if (stage === 'mark')
      vi.mocked(db.markContactsAsMatched).mockRejectedValueOnce(error);
    if (stage === 'metadata')
      mocks.updateContactMetadata.mockRejectedValueOnce(error);
    expect(
      await syncContactDiscovery(undefined, { invokeHandler: false })
    ).toEqual({ didSucceed: false, didDiscover: true, newMatches: matches });
  }
);
