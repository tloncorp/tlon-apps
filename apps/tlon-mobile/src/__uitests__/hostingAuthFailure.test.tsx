import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, cleanup, renderHook } from '@testing-library/react-native';
import { getHostingHeartBeat } from '@tloncorp/api';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import * as db from '@tloncorp/shared/db';
import { configureClient } from '@tloncorp/shared/store';
import { Alert, Platform } from 'react-native';

jest.mock('@tloncorp/api', () => ({
  getHostingHeartBeat: jest.fn(),
  reportBackgroundFailure: () => () => {},
}));
jest.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {},
  createDevLogger: () => ({ log: jest.fn(), trackEvent: jest.fn() }),
  sync: {},
}));
jest.mock('@tloncorp/shared/db', () => ({
  hostingAuthToken: { getValue: jest.fn() },
  hostingAuthExpired: { setValue: jest.fn() },
}));
jest.mock('@tloncorp/shared/store', () => ({ configureClient: jest.fn() }));
jest.mock('@tloncorp/app/constants', () => ({ ENABLED_LOGGERS: [] }));
jest.mock('@tloncorp/app/contexts/ship', () => ({ useShip: jest.fn() }));
jest.mock('@tloncorp/app/lib/resetDb', () => ({ resetDb: jest.fn() }));
jest.mock('@tloncorp/app/platform/polyfills', () => ({
  initializePolyfills: jest.fn(),
}));
jest.mock('@tloncorp/app/hooks/useHandleLogout', () => {
  const logout = jest.fn(async () => {});
  return { useHandleLogout: () => logout };
});

function configure() {
  const { result } = renderHook(() => useConfigureUrbitClient());
  act(() => result.current());
  return jest.mocked(configureClient).mock.calls.at(-1)![0].handleAuthFailure!;
}

describe('ship authentication failure with expired Hosting auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.mocked(useShip).mockReturnValue({
      ship: '~zod',
      shipUrl: 'https://zod.tlon.network',
      authType: 'hosted',
    } as ReturnType<typeof useShip>);
    jest
      .mocked(db.hostingAuthToken.getValue)
      .mockReset()
      .mockResolvedValue('session-old');
    jest.mocked(db.hostingAuthExpired.setValue).mockResolvedValue();
    jest.mocked(getHostingHeartBeat).mockReset().mockResolvedValue('expired');
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it.each(['ios', 'android'] as const)(
    'requests recovery on %s without logging out',
    async (platform) => {
      jest.replaceProperty(Platform, 'OS', platform);
      const onAuthFailure = configure();
      await act(async () => onAuthFailure({ mustLogout: false }));
      expect(db.hostingAuthExpired.setValue).toHaveBeenCalledWith(true);
      expect(useHandleLogout({ resetDb: () => {} })).not.toHaveBeenCalled();
    }
  );

  it('discards an expired response after the Hosting credential is renewed', async () => {
    let finishHeartbeat!: (result: 'expired') => void;
    jest.mocked(getHostingHeartBeat).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishHeartbeat = resolve;
        })
    );
    const onAuthFailure = configure();
    const pending = onAuthFailure({ mustLogout: false });
    await act(async () => {});
    jest
      .mocked(db.hostingAuthToken.getValue)
      .mockResolvedValue('session-renewed');
    await act(async () => {
      finishHeartbeat('expired');
      await pending;
    });
    expect(db.hostingAuthExpired.setValue).not.toHaveBeenCalled();
    expect(useHandleLogout({ resetDb: () => {} })).not.toHaveBeenCalled();
  });

  it.each(['ok', 'unknown'] as const)(
    'leaves the session alone for a %s heartbeat',
    async (status) => {
      jest.mocked(getHostingHeartBeat).mockResolvedValue(status);
      const onAuthFailure = configure();
      await act(async () => onAuthFailure({ mustLogout: false }));
      expect(db.hostingAuthExpired.setValue).not.toHaveBeenCalled();
      expect(useHandleLogout({ resetDb: () => {} })).not.toHaveBeenCalled();
    }
  );

  it('leaves the session alone when Hosting is unreachable', async () => {
    jest.mocked(getHostingHeartBeat).mockRejectedValue(new Error('offline'));
    const onAuthFailure = configure();
    await act(async () => onAuthFailure({ mustLogout: false }));
    expect(db.hostingAuthExpired.setValue).not.toHaveBeenCalled();
    expect(useHandleLogout({ resetDb: () => {} })).not.toHaveBeenCalled();
  });

  it('preserves the logout behavior on web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const onAuthFailure = configure();
    await act(async () => onAuthFailure({ mustLogout: false }));
    expect(useHandleLogout({ resetDb: () => {} })).toHaveBeenCalledTimes(1);
    expect(db.hostingAuthExpired.setValue).not.toHaveBeenCalled();
  });

  it('still logs out self-hosted users who cannot recover their access code', async () => {
    jest
      .mocked(useShip)
      .mockReturnValue({ authType: 'self' } as ReturnType<typeof useShip>);
    const onAuthFailure = configure();
    await act(async () => onAuthFailure({ mustLogout: false }));
    expect(useHandleLogout({ resetDb: () => {} })).toHaveBeenCalledTimes(1);
    expect(getHostingHeartBeat).not.toHaveBeenCalled();
  });

  it('still logs out after the ship explicitly rejects its access code', async () => {
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.[0]?.onPress?.();
      });
    const onAuthFailure = configure();
    await act(async () => onAuthFailure({ mustLogout: true }));
    expect(Alert.alert).toHaveBeenCalled();
    expect(useHandleLogout({ resetDb: () => {} })).toHaveBeenCalledTimes(1);
    expect(getHostingHeartBeat).not.toHaveBeenCalled();
  });
});
