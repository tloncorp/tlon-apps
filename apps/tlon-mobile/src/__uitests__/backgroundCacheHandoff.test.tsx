import { act, renderHook } from '@testing-library/react-native';

const mockRetrieve = jest.fn();
const mockAcknowledge = jest.fn();
const mockPersist = jest.fn();
const mockCursor = jest.fn();
const mockParse = jest.fn();
const mockTrackError = jest.fn();
const mockCapture = jest.fn();

jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => {
  const actual = jest.requireActual(
    'react-native/Libraries/TurboModule/TurboModuleRegistry'
  );
  return {
    ...actual,
    get: (name: string) =>
      name === 'BackgroundCache'
        ? {
            retrieveBackgroundData: (...args: unknown[]) =>
              mockRetrieve(...args),
            acknowledgeBackgroundData: (...args: unknown[]) =>
              mockAcknowledge(...args),
            setLastSyncTimestamp: jest.fn(),
          }
        : actual.get(name),
  };
});
jest.mock('@tloncorp/api', () => ({
  parseChanges: (...args: unknown[]) => mockParse(...args),
}));
jest.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({
    log: jest.fn(),
    trackError: (...args: unknown[]) => mockTrackError(...args),
    trackEvent: (...args: unknown[]) => mockCapture(...args),
  }),
}));
jest.mock('@tloncorp/shared/db', () => ({
  CHANGES_SYNCED_AT_KEY: 'changesSyncedAt',
  registerStorageItemListener: jest.fn(),
  changesSyncedAt: { getValue: () => mockCursor() },
}));
jest.mock('@tloncorp/shared/store', () => ({
  syncCachedChanges: (...args: unknown[]) => mockPersist(...args),
}));
jest.mock('@tloncorp/shared/utils', () => ({ formattedDuration: () => '0' }));
jest.mock('@tloncorp/app/lib/chatListSettleTelemetry', () => ({
  reportChatListNativeCacheResult: jest.fn(),
}));
jest.mock('@tloncorp/app/lib/pushNotifTapTelemetry', () => ({
  reportPushNotifNativeCacheResult: jest.fn(),
}));

import { useCachedChanges } from '../hooks/useBackgroundData';

beforeEach(() => {
  jest.clearAllMocks();
  mockRetrieve.mockResolvedValue(
    JSON.stringify({
      cacheId: 'generation-1',
      beginTimestamp: 100,
      endTimestamp: 200,
      changes: {},
    })
  );
  mockParse.mockReturnValue({
    posts: [],
    groups: [],
    unreads: { channelUnreads: [], groupUnreads: [] },
  });
  mockPersist.mockResolvedValue(true);
  mockCursor.mockResolvedValue(200);
  mockAcknowledge.mockResolvedValue(true);
});

async function run() {
  const { result } = renderHook(() => useCachedChanges());
  await act(async () => {
    await result.current();
  });
}

test('acknowledges the exact generation only after persistence resolves', async () => {
  let finish!: (value: boolean) => void;
  mockPersist.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      })
  );
  const { result } = renderHook(() => useCachedChanges());
  let pending!: Promise<void>;
  await act(async () => {
    pending = result.current();
    await Promise.resolve();
  });
  expect(mockAcknowledge).not.toHaveBeenCalled();
  await act(async () => {
    finish(true);
    await pending;
  });
  expect(mockAcknowledge).toHaveBeenCalledWith('generation-1');
});

test('failed writes leave the cache unacknowledged and retryable', async () => {
  mockPersist.mockRejectedValueOnce(new Error('SQLite failed'));
  await run();
  expect(mockAcknowledge).not.toHaveBeenCalled();
  await run();
  expect(mockAcknowledge).toHaveBeenCalledTimes(1);
});

test('parse failures leave the native batch intact', async () => {
  mockParse.mockImplementationOnce(() => {
    throw new Error('invalid changes');
  });
  await run();
  expect(mockPersist).not.toHaveBeenCalled();
  expect(mockAcknowledge).not.toHaveBeenCalled();
});

test('an already-covered batch is acknowledged, but a gap is retained', async () => {
  mockPersist.mockResolvedValue(false);
  mockCursor.mockResolvedValue(50);
  await run();
  expect(mockAcknowledge).not.toHaveBeenCalled();
  mockCursor.mockResolvedValue(200);
  await run();
  expect(mockAcknowledge).toHaveBeenCalledWith('generation-1');
});

test('overlapping app-open checks share one handoff', async () => {
  const { result } = renderHook(() => useCachedChanges());
  await act(async () => {
    await Promise.all([result.current(), result.current()]);
  });
  expect(mockRetrieve).toHaveBeenCalledTimes(1);
  expect(mockPersist).toHaveBeenCalledTimes(1);
  expect(mockAcknowledge).toHaveBeenCalledTimes(1);
});

test('an acknowledgement failure does not misreport a successful insert as failed', async () => {
  mockAcknowledge.mockRejectedValueOnce(new Error('bridge failed'));
  await run();
  expect(mockTrackError).toHaveBeenCalledWith(
    'Failed to acknowledge cached changes',
    expect.any(Error)
  );
  expect(mockCapture).toHaveBeenCalledWith(
    'Synced cached changes',
    expect.objectContaining({ didInsert: true, acknowledged: null })
  );
});

test('older native handoff payloads without a generation remain usable', async () => {
  mockRetrieve.mockResolvedValue(
    JSON.stringify({ beginTimestamp: 100, endTimestamp: 200, changes: {} })
  );
  await run();
  expect(mockPersist).toHaveBeenCalledTimes(1);
  expect(mockAcknowledge).not.toHaveBeenCalled();
});

test.each([
  { beginTimestamp: 300, endTimestamp: 200 },
  { beginTimestamp: 'invalid', endTimestamp: 200 },
])(
  'invalid cache windows are retained without advancing the cursor: %p',
  async (bounds) => {
    mockRetrieve.mockResolvedValue(
      JSON.stringify({ cacheId: 'generation-1', ...bounds, changes: {} })
    );
    await run();
    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockAcknowledge).not.toHaveBeenCalled();
  }
);

test('a newer native generation surviving acknowledgement is reported accurately', async () => {
  mockAcknowledge.mockResolvedValue(false);
  await run();
  expect(mockCapture).toHaveBeenCalledWith(
    'Synced cached changes',
    expect.objectContaining({ didInsert: true, acknowledged: false })
  );
});
