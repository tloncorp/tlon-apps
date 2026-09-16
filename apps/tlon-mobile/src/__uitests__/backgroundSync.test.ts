import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { configureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { discoverContactsAndNotify } from '@tloncorp/app/lib/notifications';
import { syncSince } from '@tloncorp/shared';
import { storage, type ShipInfo } from '@tloncorp/shared/db';
import * as TaskManager from 'expo-task-manager';

import { initializeBackgroundSync } from '../lib/backgroundSync';
import { refreshHostingAuth } from '../lib/hostingAuth';

jest.mock('@tloncorp/app/hooks/useConfigureUrbitClient', () => ({
  configureUrbitClient: jest.fn(),
}));
jest.mock('@tloncorp/app/lib/nativeDb', () => ({
  ensureDbReady: async () => {},
}));
jest.mock('@tloncorp/app/lib/notifications', () => ({
  discoverContactsAndNotify: jest.fn(async () => ({ newMatchCount: 0 })),
}));
jest.mock('@tloncorp/shared', () => ({
  SyncPriority: { High: 1 },
  createDevLogger: () => ({ trackEvent: jest.fn(), trackError: jest.fn() }),
  flushErrorLogger: async () => {},
  syncSince: jest.fn(async () => {}),
}));
jest.mock('@tloncorp/shared/db', () => ({
  storage: {
    shipInfo: { getValue: jest.fn() },
    hostingAuthToken: { getValue: jest.fn() },
  },
}));
jest.mock('expo-background-fetch', () => ({}));
jest.mock('expo-background-task', () => ({
  BackgroundTaskResult: { Success: 'success', Failed: 'failed' },
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('uuid', () => ({ v4: () => 'test-task' }));
jest.mock('../lib/hostingAuth', () => ({ refreshHostingAuth: jest.fn() }));

const originalShip: ShipInfo = {
  ship: '~zod',
  shipUrl: 'https://zod.tlon.network',
  authType: 'hosted',
  authCookie: 'ship-cookie',
};

function runTask() {
  initializeBackgroundSync();
  const [taskName, execute] = jest
    .mocked(TaskManager.defineTask)
    .mock.calls.at(-1)!;
  return execute({
    data: {},
    error: null,
    executionInfo: { eventId: 'test-task', taskName, appState: 'background' },
  });
}

describe('background sync session ownership', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest
      .mocked(storage.shipInfo.getValue)
      .mockReset()
      .mockResolvedValue(originalShip);
    jest
      .mocked(storage.hostingAuthToken.getValue)
      .mockReset()
      .mockResolvedValue('session-old');
    jest.mocked(refreshHostingAuth).mockReset().mockResolvedValue('ok');
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    { change: 'logout', ship: null, token: '' },
    {
      change: 'account switch',
      ship: { ...originalShip, ship: '~nec' },
      token: 'session-new',
    },
    { change: 'token renewal', ship: originalShip, token: 'session-new' },
    {
      change: 'ship credential replacement',
      ship: { ...originalShip, authCookie: 'new-cookie' },
      token: 'session-old',
    },
  ])(
    'skips stale work after $change during the heartbeat',
    async ({ ship, token }) => {
      let finishHeartbeat!: (result: 'unknown') => void;
      let heartbeatStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        heartbeatStarted = resolve;
      });
      jest.mocked(refreshHostingAuth).mockImplementationOnce(() => {
        heartbeatStarted();
        return new Promise((resolve) => {
          finishHeartbeat = resolve;
        });
      });
      const pending = runTask();
      await started;
      jest.mocked(storage.shipInfo.getValue).mockResolvedValue(ship);
      jest.mocked(storage.hostingAuthToken.getValue).mockResolvedValue(token);
      finishHeartbeat('unknown');
      await pending;
      expect(configureUrbitClient).not.toHaveBeenCalled();
      expect(syncSince).not.toHaveBeenCalled();
      expect(discoverContactsAndNotify).not.toHaveBeenCalled();
      expect(storage.shipInfo.getValue).toHaveBeenLastCalledWith(true);
      expect(storage.hostingAuthToken.getValue).toHaveBeenLastCalledWith(true);
    }
  );

  it.each(['ok', 'unknown', 'skipped'] as const)(
    'still syncs an unchanged session after a %s auth check',
    async (status) => {
      jest.mocked(refreshHostingAuth).mockResolvedValue(status);
      await runTask();
      expect(configureUrbitClient).toHaveBeenCalledWith({
        ship: originalShip.ship,
        shipUrl: originalShip.shipUrl,
        authType: originalShip.authType,
      });
      expect(syncSince).toHaveBeenCalledTimes(1);
      expect(discoverContactsAndNotify).toHaveBeenCalledTimes(1);
    }
  );

  it('skips an expired session', async () => {
    jest.mocked(refreshHostingAuth).mockResolvedValue('expired');
    await runTask();
    expect(configureUrbitClient).not.toHaveBeenCalled();
    expect(syncSince).not.toHaveBeenCalled();
  });
});
