import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RootErrorBoundary } from '@tloncorp/app/RootErrorBoundary';
import { ensureDbReady } from '@tloncorp/app/lib/nativeDb';
import { useDebugStore } from '@tloncorp/shared';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, Text } from 'react-native';
import { act } from 'react-test-renderer';

import { useDbReady } from '../hooks/useDbReady';

jest.mock('@tloncorp/app/lib/nativeDb', () => ({
  ensureDbReady: jest.fn(),
}));

// The shared barrel drags in expo-contacts and the rest of the sync graph,
// which cannot load under jest-expo. Everything exercised here — the real
// logger, the debug store — lives in the debug module.
jest.mock('@tloncorp/shared', () => ({
  ...(jest.requireActual('@tloncorp/shared/debug') as object),
  AnalyticsEvent: {
    DbReadyRetrySucceeded: 'DB Ready Retry Succeeded',
  },
}));

// `@tloncorp/ui/config` boots tamagui, which reaches moti -> reanimated ->
// react-native-worklets and fails to initialise under jest-expo. The boundary
// only reads colours from it.
jest.mock('@tloncorp/ui/config', () => ({
  themes: {
    light: {
      background: '#FFFFFF',
      border: '#E5E5E5',
      primaryText: '#1A1818',
      secondaryBackground: '#F5F5F5',
      secondaryText: '#666666',
    },
  },
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(async () => true),
  preventAutoHideAsync: jest.fn(async () => true),
}));

const ensureDbReadyMock = jest.mocked(ensureDbReady);
const hideAsyncMock = jest.mocked(SplashScreen.hideAsync);

// Mirrors index.tsx's MainInner: gate on the database, throw the init error
// during render so the root boundary catches it.
function Gate() {
  const { dbInitError, isDbReady } = useDbReady();

  if (dbInitError) {
    throw dbInitError;
  }

  return isDbReady ? <Text>READY</Text> : null;
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

const platforms = ['ios', 'android'] as const;

describe.each(platforms)('RootErrorBoundary on %s', (os) => {
  let osProperty: { restore: () => void };
  let capture: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    jest.useFakeTimers();
    osProperty = jest.replaceProperty(
      Platform as unknown as { OS: string },
      'OS',
      os
    );
    ensureDbReadyMock.mockReset();
    hideAsyncMock.mockClear();
    capture = jest.fn();
    useDebugStore.getState().initializeErrorLogger({
      capture: capture as unknown as (
        event: string,
        data: Record<string, unknown>
      ) => void,
    });
  });

  afterEach(() => {
    osProperty.restore();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('reports the db timeout and remounts the gate on retry', async () => {
    ensureDbReadyMock.mockImplementation(() => new Promise<void>(() => {}));

    render(
      <RootErrorBoundary>
        <Gate />
      </RootErrorBoundary>
    );

    await advance(30_000);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(hideAsyncMock).toHaveBeenCalledTimes(1);

    const appErrors = capture.mock.calls.filter(
      ([event]) => event === 'app_error'
    ) as Array<[string, Record<string, any>]>;
    expect(appErrors).toHaveLength(1);
    const payload = appErrors[0][1];
    expect(payload.errorObject.name).toBe('DbInitTimeoutError');
    expect(payload.lastError).toBeNull();
    expect(payload.attempt).toBe(1);
    expect(payload.elapsedMs).toBe(30_000);

    ensureDbReadyMock.mockImplementation(() => Promise.resolve());

    fireEvent.press(screen.getByText('Try again'));
    await advance(0);

    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.getByText('READY')).toBeTruthy();
  });
});
