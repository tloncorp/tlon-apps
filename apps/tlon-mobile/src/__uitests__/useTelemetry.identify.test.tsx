import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

const mockState = {
  distinctId: '0192-anon' as string | undefined,
  sdkOptedOut: false,
  readyPromise: Promise.resolve(),
  session: { phase: 'ready', startTime: 1 } as {
    phase: string;
    startTime: number;
  } | null,
  settings: {
    data: { enableTelemetry: true as boolean | null, logActivity: null },
    isLoading: false,
  },
};

// The real web variant of this module calls `posthog.init` at import time.
jest.mock('@tloncorp/app/hooks/usePosthog', () => {
  const fake = {
    getIsOptedOut: () => mockState.sdkOptedOut,
    optIn: jest.fn(),
    optOut: jest.fn(),
    capture: jest.fn(),
    reset: jest.fn(),
    flush: jest.fn(async () => {}),
    identify: jest.fn((userId: string) => {
      mockState.distinctId = userId;
    }),
    distinctId: () => mockState.distinctId,
    ready: jest.fn(() => mockState.readyPromise),
  };
  return { usePosthog: () => fake };
});

jest.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { AppActive: 'App Active', WebAppOpened: 'Web App Opened' },
  clearBreadcrumbs: jest.fn(),
  createDevLogger: () => ({
    log: jest.fn(),
    crumb: jest.fn(),
    trackError: jest.fn(),
    trackEvent: jest.fn(),
  }),
  useCurrentSession: () => mockState.session,
}));

jest.mock('@tloncorp/shared/db', () => {
  const storageItem = {
    value: true,
    isLoading: false,
    setValue: jest.fn(),
    resetValue: jest.fn(),
  };
  return {
    didInitializeTelemetry: {
      useStorageItem: () => storageItem,
      getValue: async () => true,
      resetValue: jest.fn(),
    },
    hasClearedLegacyWebTelemetry: {
      getValue: async () => true,
      setValue: jest.fn(),
    },
    lastAnonymousAppOpenAt: {
      getValue: async () => null,
      setValue: jest.fn(),
      resetValue: jest.fn(),
    },
  };
});

jest.mock('@tloncorp/shared/store', () => ({
  useTelemetrySettings: () => mockState.settings,
  updateEnableTelemetry: jest.fn(),
}));

// `@tloncorp/api`'s exports map has no `require` condition, so jest cannot
// resolve it; a bare-specifier virtual mock keys globally and covers the
// hook's own import.
jest.mock('@tloncorp/api', () => ({ getCurrentUserIsHosted: () => true }), {
  virtual: true,
});

jest.mock('@tloncorp/app/hooks/useCurrentUser', () => ({
  useCurrentUserId: () => '~sampel-palnet',
}));

jest.mock('tamagui', () => ({ isWeb: false }));

// Aliased: the mock returns one shared object, so this reads the fake rather
// than acting as a hook call.
import { usePosthog as readFakePosthog } from '@tloncorp/app/hooks/usePosthog';
import { useTelemetry } from '@tloncorp/app/hooks/useTelemetry';

const posthog = readFakePosthog();

let resolveReady!: () => void;

beforeEach(() => {
  mockState.distinctId = '0192-anon';
  mockState.sdkOptedOut = false;
  mockState.session = { phase: 'ready', startTime: 1 };
  mockState.settings = {
    data: { enableTelemetry: true, logActivity: null },
    isLoading: false,
  };
  mockState.readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  jest.clearAllMocks();
});

afterEach(() => {
  resolveReady();
});

async function settleReady() {
  await act(async () => {
    resolveReady();
  });
}

describe('useTelemetry identify-on-session', () => {
  it('identifies the ship once the sdk reports ready', async () => {
    renderHook(() => useTelemetry());

    expect(posthog.identify).not.toHaveBeenCalled();

    await settleReady();

    expect(posthog.identify).toHaveBeenCalledTimes(1);
    expect(posthog.identify).toHaveBeenCalledWith('~sampel-palnet', {
      isHostedUser: true,
      userId: '~sampel-palnet',
    });
  });

  it('does not re-identify when the sdk already reports the ship', async () => {
    mockState.distinctId = '~sampel-palnet';

    renderHook(() => useTelemetry());
    await settleReady();

    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it('does not identify when telemetry is disabled', async () => {
    mockState.settings = {
      data: { enableTelemetry: false, logActivity: null },
      isLoading: false,
    };
    mockState.sdkOptedOut = true;

    renderHook(() => useTelemetry());
    await settleReady();

    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it('honours an opt-out that only becomes readable once the sdk is ready', async () => {
    mockState.settings = {
      data: { enableTelemetry: null, logActivity: null },
      isLoading: false,
    };
    mockState.sdkOptedOut = false;

    renderHook(() => useTelemetry());

    await act(async () => {
      mockState.sdkOptedOut = true;
      resolveReady();
    });

    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it('waits for settings to load before identifying', async () => {
    mockState.settings = {
      data: { enableTelemetry: true, logActivity: null },
      isLoading: true,
    };

    const { rerender } = renderHook(() => useTelemetry());
    await settleReady();

    expect(posthog.ready).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();

    mockState.settings = {
      data: { enableTelemetry: true, logActivity: null },
      isLoading: false,
    };
    mockState.readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    await act(async () => {
      rerender(undefined);
    });
    await settleReady();

    expect(posthog.identify).toHaveBeenCalledTimes(1);
  });

  it('identifies once across multiple mounted consumers', async () => {
    renderHook(() => useTelemetry());
    renderHook(() => useTelemetry());

    await settleReady();

    expect(posthog.identify).toHaveBeenCalledTimes(1);
  });
});
