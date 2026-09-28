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
import { createDevLogger, flushErrorLogger, syncSince } from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
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
  discoverContactsAndNotify: jest.fn(),
}));
jest.mock('@tloncorp/shared', () => {
  const logger = { trackEvent: jest.fn(), trackError: jest.fn() };
  return {
    SyncPriority: { High: 1 },
    createDevLogger: () => logger,
    flushErrorLogger: jest.fn(async () => {}),
    syncSince: jest.fn(),
  };
});
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

const logger = createDevLogger('test', false);
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

describe('background sync outcomes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.mocked(refreshHostingAuth).mockReset().mockResolvedValue('skipped');
    jest.mocked(storage.hostingAuthToken.getValue).mockResolvedValue('');
    jest.mocked(storage.shipInfo.getValue).mockResolvedValue({
      ship: '~zod',
      shipUrl: 'https://zod.tlon.network',
      authType: 'self',
      authCookie: 'test-cookie',
    });
    jest.mocked(syncSince).mockReset().mockResolvedValue('success');
    jest
      .mocked(discoverContactsAndNotify)
      .mockReset()
      .mockResolvedValue({ newMatchCount: 0, didSucceed: true });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports success only after both stages succeed', async () => {
    expect(await runTask()).toBe('success');
    expect(logger.trackEvent).toHaveBeenCalledWith(
      'Background sync complete',
      expect.objectContaining({ taskExecutionId: 'test-task' })
    );
    expect(logger.trackEvent).toHaveBeenCalledWith(
      'Background sync timing',
      expect.objectContaining({ didSucceed: true })
    );
    expect(flushErrorLogger).toHaveBeenCalled();
  });

  it.each(['sync', 'discovery'] as const)(
    'reports a %s failure to telemetry and the scheduler',
    async (stage) => {
      if (stage === 'sync') jest.mocked(syncSince).mockResolvedValue('error');
      else
        jest
          .mocked(discoverContactsAndNotify)
          .mockResolvedValue({ newMatchCount: 0, didSucceed: false });
      expect(await runTask()).toBe('failed');
      expect(logger.trackEvent).not.toHaveBeenCalledWith(
        'Background sync complete',
        expect.anything()
      );
      expect(logger.trackEvent).toHaveBeenCalledWith(
        'Background sync timing',
        expect.objectContaining({
          didSucceed: false,
          taskExecutionId: 'test-task',
        })
      );
      expect(discoverContactsAndNotify).toHaveBeenCalled();
      expect(flushErrorLogger).toHaveBeenCalled();
    }
  );

  it('preserves unexpected exceptions as failures', async () => {
    const error = new Error('notification failure');
    jest.mocked(discoverContactsAndNotify).mockRejectedValue(error);
    expect(await runTask()).toBe('failed');
    expect(logger.trackError).toHaveBeenCalledWith(
      'Background sync failed',
      expect.objectContaining({ error })
    );
    expect(logger.trackEvent).toHaveBeenCalledWith(
      'Background sync timing',
      expect.objectContaining({ didSucceed: false })
    );
  });

  it('treats missing credentials as skipped work without reporting completion', async () => {
    jest.mocked(storage.shipInfo.getValue).mockResolvedValue(null);
    expect(await runTask()).toBe('success');
    expect(configureUrbitClient).not.toHaveBeenCalled();
    expect(syncSince).not.toHaveBeenCalled();
    expect(logger.trackEvent).not.toHaveBeenCalledWith(
      'Background sync complete',
      expect.anything()
    );
  });
});
