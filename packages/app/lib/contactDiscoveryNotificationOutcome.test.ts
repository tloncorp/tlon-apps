import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  syncContactDiscovery: vi.fn(),
  firstSyncComplete: vi.fn(),
  getSystemContacts: vi.fn(),
  trackEvent: vi.fn(),
  getPermissions: vi.fn(),
  scheduleNotification: vi.fn(),
}));
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { ErrorContactMatching: 'Contact Matching Error' },
  AnalyticsSeverity: { Critical: 'critical' },
  createDevLogger: () => ({
    log: vi.fn(),
    debug: vi.fn(),
    trackEvent: mocks.trackEvent,
  }),
  syncContactDiscovery: mocks.syncContactDiscovery,
}));
vi.mock('@tloncorp/shared/db', () => ({
  userHasCompletedFirstSync: { getValue: mocks.firstSyncComplete },
  getSystemContactsBatchByContactId: mocks.getSystemContacts,
}));
vi.mock('@tloncorp/shared/store', () => ({}));
vi.mock('@tloncorp/shared/domain', () => ({}));
vi.mock('expo-device', () => ({}));
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: mocks.getPermissions,
  scheduleNotificationAsync: mocks.scheduleNotification,
}));
vi.mock('../hooks/useAppStatusChange', () => ({ AppStatus: {} }));
vi.mock('./notificationsApi', () => ({}));

import { discoverContactsAndNotify } from './notifications';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.firstSyncComplete.mockResolvedValue(false);
  mocks.getPermissions.mockResolvedValue({
    status: 'granted',
    canAskAgain: true,
  });
  mocks.scheduleNotification.mockResolvedValue('synthetic-notification');
  mocks.getSystemContacts.mockResolvedValue([
    { id: 'native', contactId: '~nec', firstName: 'Address', lastName: 'Book' },
  ]);
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

test('one confirmed account schedules the existing named notification', async () => {
  mocks.firstSyncComplete.mockResolvedValue(true);
  mocks.syncContactDiscovery.mockResolvedValue({
    didSucceed: true,
    didDiscover: true,
    newMatches: [['synthetic-phone', '~nec']],
  });
  expect(await discoverContactsAndNotify()).toEqual({
    didSucceed: true,
    newMatchCount: 1,
  });
  expect(mocks.scheduleNotification).toHaveBeenCalledTimes(1);
  expect(mocks.scheduleNotification).toHaveBeenCalledWith({
    content: {
      title: 'Address Book is on Tlon',
      body: 'Tap to say hi',
      data: { type: 'contactMatched', contactId: '~nec' },
    },
    trigger: null,
  });
});

test('distinct confirmed accounts schedule one existing grouped notification with the account count', async () => {
  mocks.firstSyncComplete.mockResolvedValue(true);
  mocks.syncContactDiscovery.mockResolvedValue({
    didSucceed: true,
    didDiscover: true,
    newMatches: [
      ['first-phone', '~nec'],
      ['second-phone', '~bud'],
    ],
  });
  expect(await discoverContactsAndNotify()).toEqual({
    didSucceed: true,
    newMatchCount: 2,
  });
  expect(mocks.scheduleNotification).toHaveBeenCalledTimes(1);
  expect(mocks.scheduleNotification).toHaveBeenCalledWith({
    content: {
      title: '2 of your contacts are on Tlon',
      body: 'Tap to see who',
      data: { type: 'contactsMatched' },
    },
    trigger: null,
  });
});

test('account-based results retain the first-sync notification suppression', async () => {
  mocks.syncContactDiscovery.mockResolvedValue({
    didSucceed: true,
    didDiscover: true,
    newMatches: [['synthetic-phone', '~nec']],
  });
  expect(await discoverContactsAndNotify()).toEqual({
    didSucceed: true,
    newMatchCount: 1,
  });
  expect(mocks.scheduleNotification).not.toHaveBeenCalled();
});

test('denied notification permission preserves successful discovery without scheduling', async () => {
  mocks.firstSyncComplete.mockResolvedValue(true);
  mocks.getPermissions.mockResolvedValue({
    status: 'denied',
    canAskAgain: false,
  });
  mocks.syncContactDiscovery.mockResolvedValue({
    didSucceed: true,
    didDiscover: true,
    newMatches: [['synthetic-phone', '~nec']],
  });
  expect(await discoverContactsAndNotify()).toEqual({
    didSucceed: true,
    newMatchCount: 1,
  });
  expect(mocks.scheduleNotification).not.toHaveBeenCalled();
});

test('multiple confirmed phones for one account schedule one named notification and count one match', async () => {
  mocks.firstSyncComplete.mockResolvedValue(true);
  mocks.syncContactDiscovery.mockResolvedValue({
    didSucceed: true,
    didDiscover: true,
    newMatches: [
      ['first-phone', '~nec'],
      ['second-phone', '~nec'],
    ],
  });
  expect(await discoverContactsAndNotify()).toEqual({
    didSucceed: true,
    newMatchCount: 1,
  });
  expect(mocks.scheduleNotification).toHaveBeenCalledTimes(1);
  expect(mocks.scheduleNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({
        title: 'Address Book is on Tlon',
        data: { type: 'contactMatched', contactId: '~nec' },
      }),
    })
  );
});

test('grouped notification counts distinct accounts while discovery preserves every phone match', async () => {
  mocks.firstSyncComplete.mockResolvedValue(true);
  mocks.syncContactDiscovery.mockResolvedValue({
    didSucceed: true,
    didDiscover: true,
    newMatches: [
      ['first-phone', '~nec'],
      ['second-phone', '~nec'],
      ['third-phone', '~bud'],
    ],
  });
  expect(await discoverContactsAndNotify()).toEqual({
    didSucceed: true,
    newMatchCount: 2,
  });
  expect(mocks.scheduleNotification).toHaveBeenCalledTimes(1);
  expect(mocks.scheduleNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({
        title: '2 of your contacts are on Tlon',
        data: { type: 'contactsMatched' },
      }),
    })
  );
});
