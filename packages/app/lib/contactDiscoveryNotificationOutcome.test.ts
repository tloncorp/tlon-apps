import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  syncContactDiscovery: vi.fn(),
  firstSyncComplete: vi.fn(),
  getSystemContacts: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { ErrorContactMatching: 'Contact Matching Error' },
  AnalyticsSeverity: { Critical: 'critical' },
  createDevLogger: () => ({ log: vi.fn(), trackEvent: mocks.trackEvent }),
  syncContactDiscovery: mocks.syncContactDiscovery,
}));
vi.mock('@tloncorp/shared/db', () => ({
  userHasCompletedFirstSync: { getValue: mocks.firstSyncComplete },
  getSystemContactsBatchByContactId: mocks.getSystemContacts,
}));
vi.mock('@tloncorp/shared/store', () => ({}));
vi.mock('@tloncorp/shared/domain', () => ({}));
vi.mock('expo-device', () => ({}));
vi.mock('expo-notifications', () => ({}));
vi.mock('../hooks/useAppStatusChange', () => ({ AppStatus: {} }));
vi.mock('./notificationsApi', () => ({}));

import { discoverContactsAndNotify } from './notifications';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.firstSyncComplete.mockResolvedValue(false);
});

test.each([true, false])(
  'preserves discovery success=%s with zero matches',
  async (didSucceed) => {
    mocks.syncContactDiscovery.mockResolvedValue({
      didSucceed,
      didDiscover: didSucceed,
      newMatches: [],
    });
    expect(await discoverContactsAndNotify()).toEqual({
      didSucceed,
      newMatchCount: 0,
    });
  }
);

test('reports a thrown initialization failure with its task context', async () => {
  const error = new Error('Urbit client not set');
  mocks.syncContactDiscovery.mockRejectedValueOnce(error);
  expect(
    await discoverContactsAndNotify({ context: { taskExecutionId: 'task-1' } })
  ).toEqual({ didSucceed: false, newMatchCount: 0 });
  expect(mocks.trackEvent).toHaveBeenCalledWith(
    'Contact Matching Error',
    expect.objectContaining({ error, taskExecutionId: 'task-1' })
  );
});

test.each([true, false])(
  'preserves discovery success=%s when matches exist',
  async (didSucceed) => {
    mocks.syncContactDiscovery.mockResolvedValue({
      didSucceed,
      didDiscover: true,
      newMatches: [['hash', '~zod']],
    });
    expect(await discoverContactsAndNotify()).toEqual({
      didSucceed,
      newMatchCount: 1,
    });
  }
);

test('notification failures remain failures after successful discovery', async () => {
  mocks.syncContactDiscovery.mockResolvedValue({
    didSucceed: true,
    didDiscover: true,
    newMatches: [['hash', '~zod']],
  });
  mocks.firstSyncComplete.mockResolvedValue(true);
  const error = new Error('notification lookup failed');
  mocks.getSystemContacts.mockRejectedValueOnce(error);
  expect(await discoverContactsAndNotify()).toEqual({
    didSucceed: false,
    newMatchCount: 1,
  });
  expect(mocks.trackEvent).toHaveBeenCalledWith(
    'Contact Matching Error',
    expect.objectContaining({ error })
  );
});
