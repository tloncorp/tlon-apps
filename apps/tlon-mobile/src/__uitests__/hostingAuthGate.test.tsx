import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { useNetInfo } from '@react-native-community/netinfo';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { Text } from 'react-native';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import * as db from '@tloncorp/shared/db';

import ConnectedAuthenticatedApp from '../components/AuthenticatedApp';
import { refreshHostingAuth } from '../lib/hostingAuth';
import { setActiveNotificationRoute } from '../lib/notificationPresentation';
import { sync } from '@tloncorp/shared';

jest.unmock('../components/AuthenticatedApp');
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
  useNetInfo: jest.fn(),
}));
jest.mock('@tloncorp/app/contexts/ship', () => ({
  useShip: () => ({ authType: 'hosted' }),
}));
jest.mock('@tloncorp/app/hooks/useAppStatusChange', () => ({
  useAppStatusChange: jest.fn(),
}));
jest.mock('@tloncorp/app/hooks/useConfigureUrbitClient', () => {
  const configure = jest.fn();
  return { useConfigureUrbitClient: () => configure };
});
jest.mock('@tloncorp/app/hooks/useFindSuggestedContacts', () => ({
  useFindSuggestedContacts: jest.fn(),
}));
jest.mock('@tloncorp/app/hooks/useNetworkLogger', () => ({
  useNetworkLogger: jest.fn(),
}));
jest.mock('@tloncorp/app/hooks/useTelemetry', () => ({
  useTelemetry: () => ({}),
}));
jest.mock('@tloncorp/app/lib/chatListSettleTelemetry', () => ({}));
jest.mock('@tloncorp/app/lib/envVars', () => ({ AUTOMATED_TEST: false }));
jest.mock('@tloncorp/app/lib/notifications', () => ({
  useUpdatePresentedNotifications: jest.fn(),
}));
jest.mock('@tloncorp/app/lib/pushNotifTapTelemetry', () => ({}));
jest.mock('@tloncorp/app/lib/tlonbotRevivalDeferredConfig', () => ({}));
// The authenticated tree is rooted at the top-level drawer, which holds the
// root stack. This gate is about what gets past the auth check, not about what
// the tree renders, so the whole tree stands in as one node.
jest.mock('@tloncorp/app/navigation/AppDrawer', () => {
  const { Text } = require('react-native');
  return { AppDrawer: () => <Text>Authenticated content</Text> };
});
jest.mock('@tloncorp/app/provider/AppDataProvider', () => ({
  AppDataProvider: require('react-native').View,
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: require('react-native').View,
}));
jest.mock('@tloncorp/app/ui', () => {
  const { View, Text } = require('react-native');
  return {
    ForwardPostSheetProvider: View,
    ZStack: View,
    LoadingSpinner: () => <Text>Checking session</Text>,
    useWebAppSplash: () => ({}),
  };
});
jest.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({
    log: jest.fn(),
    trackEvent: jest.fn(),
    trackError: jest.fn(),
  }),
  observeSyncSinceCompletion: jest.fn(),
  sync: { syncStart: jest.fn<() => Promise<sync.SyncStartOutcome>>() },
}));
jest.mock('@tloncorp/shared/db', () => {
  const { useSyncExternalStore } = require('react');
  let expired = false;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    didSyncInitialPosts: { getValue: async () => true },
    nodeStoppedWhileLoggedIn: { setValue: jest.fn() },
    hostingAuthExpired: {
      useValue: () => useSyncExternalStore(subscribe, () => expired),
      setValue: async (value: boolean) => {
        expired = value;
        listeners.forEach((listener) => listener());
      },
    },
  };
});
jest.mock('@tloncorp/shared/store', () => ({
  confirmHostingAuthReconnectCode: async () => {
    await require('@tloncorp/shared/db').hostingAuthExpired.setValue(false);
  },
  // These tests exercise the hosting-auth gate, not the desk gate, so the desk
  // reads as compatible throughout — which is what every predicate below
  // returns for a session whose deskCompat is `{ status: 'ok' }`.
  useDeskCompatibility: () => ({ status: 'ok' }),
  isDeskGated: () => false,
  isDeskProbePending: () => false,
  shouldShowDeskNotice: () => false,
}));
jest.mock('../hooks/analytics', () => ({ useCheckAppUpdated: jest.fn() }));
jest.mock('../hooks/useAutomatedTestDbCommands', () => ({
  useAutomatedTestDbCommands: jest.fn(),
}));
jest.mock('../hooks/useBackgroundData', () => ({
  useCachedChanges: jest.fn(),
}));
jest.mock('../hooks/useCheckNodeStopped', () => ({
  useCheckNodeStopped: jest.fn(),
}));
jest.mock('../hooks/useDeepLinkListener', () => ({
  useDeepLinkListener: jest.fn(),
}));
jest.mock('../hooks/useNotificationListener', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../hooks/usePoorUxShakeReport', () => ({
  usePoorUxShakeReport: () => ({}),
}));
jest.mock('../hooks/useSyncAppBadge', () => ({ useSyncAppBadge: jest.fn() }));
jest.mock('../hooks/useSyncReactionCapability', () => ({
  useSyncReactionCapability: jest.fn(),
}));
jest.mock('../hooks/useRecaptcha', () => ({ useRecaptcha: () => ({}) }));
jest.mock('../lib/contactsHelpers', () => ({}));
jest.mock('../lib/notificationPresentation', () => ({
  setActiveNotificationRoute: jest.fn(),
}));
jest.mock('../lib/hostingAuth', () => ({
  refreshHostingAuth: jest.fn(),
  clearHostingNativeCookie: async () => {},
}));
jest.mock('../screens/HostingAuthReconnectScreen', () => {
  const { Pressable, Text } = require('react-native');
  return {
    HostingAuthReconnectScreen: ({
      onVerifyCode,
    }: {
      onVerifyCode: (otp: string) => Promise<void>;
    }) => (
      <Pressable onPress={() => void onVerifyCode('123456')}>
        <Text>Reconnect session</Text>
      </Pressable>
    ),
  };
});
jest.mock('../screens/e2e/AutomatedTestSyncScreen', () => ({}));
jest.mock('../components/ShareIntentForwardSheetProvider', () => ({
  ShareIntentForwardSheetProvider: require('react-native').View,
}));
jest.mock('../components/TlonbotRevivalPromptSheet', () => ({
  useTlonbotRevivalPrompt: () => ({}),
}));

describe('Hosting auth gate', () => {
  beforeEach(async () => {
    jest.mocked(useNetInfo).mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
    } as ReturnType<typeof useNetInfo>);
    await db.hostingAuthExpired.setValue(false);
    jest.mocked(refreshHostingAuth).mockReset().mockResolvedValue('ok');
    jest.mocked(sync.syncStart).mockReset().mockResolvedValue('ok');
    jest.mocked(useConfigureUrbitClient()).mockClear();
  });
  afterEach(cleanup);

  it.each([null, false])(
    'rechecks when reachability changes from %s to true while still connected',
    async (isInternetReachable) => {
      jest.mocked(useNetInfo).mockReturnValue({
        isConnected: true,
        isInternetReachable,
      } as ReturnType<typeof useNetInfo>);
      jest
        .mocked(refreshHostingAuth)
        .mockResolvedValueOnce('unknown')
        .mockResolvedValueOnce('expired');
      const view = render(
        <ConnectedAuthenticatedApp connected onLogout={() => {}} />
      );
      await act(async () => {});
      expect(screen.getByText('Authenticated content')).toBeTruthy();

      jest.mocked(useNetInfo).mockReturnValue({
        isConnected: true,
        isInternetReachable: true,
      } as ReturnType<typeof useNetInfo>);
      view.rerender(
        <ConnectedAuthenticatedApp connected onLogout={() => {}} />
      );
      await act(async () => {});
      expect(refreshHostingAuth).toHaveBeenCalledTimes(2);
      expect(refreshHostingAuth).toHaveBeenLastCalledWith({
        authType: 'hosted',
        force: true,
      });
      expect(screen.getByText('Reconnect session')).toBeTruthy();
      expect(screen.queryByText('Authenticated content')).toBeNull();
      expect(sync.syncStart).toHaveBeenCalledTimes(1);
    }
  );

  it('waits for a fresh check when reachability resolves during startup', async () => {
    jest.mocked(useNetInfo).mockReturnValue({
      isConnected: true,
      isInternetReachable: null,
    } as ReturnType<typeof useNetInfo>);
    let finishOldCheck!: (result: 'unknown') => void;
    jest
      .mocked(refreshHostingAuth)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOldCheck = resolve;
          })
      )
      .mockResolvedValueOnce('expired');
    const view = render(
      <ConnectedAuthenticatedApp connected onLogout={() => {}} />
    );
    jest.mocked(useNetInfo).mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
    } as ReturnType<typeof useNetInfo>);
    view.rerender(<ConnectedAuthenticatedApp connected onLogout={() => {}} />);

    await act(async () => finishOldCheck('unknown'));
    expect(refreshHostingAuth).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Reconnect session')).toBeTruthy();
    expect(sync.syncStart).not.toHaveBeenCalled();
  });

  it('rechecks after a previously valid connection goes offline and returns', async () => {
    const view = render(
      <ConnectedAuthenticatedApp connected onLogout={() => {}} />
    );
    await act(async () => {});
    expect(screen.getByText('Authenticated content')).toBeTruthy();
    expect(sync.syncStart).toHaveBeenCalledTimes(1);

    view.rerender(
      <ConnectedAuthenticatedApp
        connected={false}
        onLogout={() => {}}
        authenticatedContent={<Text>Offline</Text>}
      />
    );
    expect(screen.getByText('Offline')).toBeTruthy();
    jest.mocked(refreshHostingAuth).mockResolvedValueOnce('expired');
    view.rerender(<ConnectedAuthenticatedApp connected onLogout={() => {}} />);
    expect(screen.queryByText('Authenticated content')).toBeNull();
    await act(async () => {});
    expect(screen.getByText('Reconnect session')).toBeTruthy();
    expect(sync.syncStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(screen.getByText('Reconnect session'));
    });
    expect(screen.getByText('Authenticated content')).toBeTruthy();
    expect(sync.syncStart).toHaveBeenCalledTimes(1);
    expect(useConfigureUrbitClient()).toHaveBeenCalledTimes(1);
  });

  it('handles client-reported expiration immediately and reuses subscriptions after OTP', async () => {
    const logout = jest.fn<() => void>();
    render(<ConnectedAuthenticatedApp connected onLogout={logout} />);
    await act(async () => {});
    expect(screen.getByText('Authenticated content')).toBeTruthy();

    for (let attempt = 0; attempt < 2; attempt++) {
      jest.mocked(setActiveNotificationRoute).mockClear();
      await act(async () => {
        await db.hostingAuthExpired.setValue(true);
      });
      expect(screen.getByText('Reconnect session')).toBeTruthy();
      expect(screen.queryByText('Authenticated content')).toBeNull();
      expect(logout).not.toHaveBeenCalled();
      expect(setActiveNotificationRoute).toHaveBeenCalledWith(undefined);

      await act(async () => {
        fireEvent.press(screen.getByText('Reconnect session'));
      });
      expect(screen.getByText('Authenticated content')).toBeTruthy();
      expect(sync.syncStart).toHaveBeenCalledTimes(1);
      expect(useConfigureUrbitClient()).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps a previously reported expiration gated before client initialization', async () => {
    await db.hostingAuthExpired.setValue(true);
    render(<ConnectedAuthenticatedApp connected onLogout={() => {}} />);
    await act(async () => {});
    expect(screen.getByText('Reconnect session')).toBeTruthy();
    expect(sync.syncStart).not.toHaveBeenCalled();
    expect(useConfigureUrbitClient()).not.toHaveBeenCalled();
  });

  it('checks restored connectivity before mounting authenticated content', async () => {
    const view = render(
      <ConnectedAuthenticatedApp
        connected={false}
        onLogout={() => {}}
        authenticatedContent={<Text>Offline</Text>}
      />
    );
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(refreshHostingAuth).not.toHaveBeenCalled();
    let finishCheck!: (result: 'expired') => void;
    jest.mocked(refreshHostingAuth).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCheck = resolve;
        })
    );

    view.rerender(<ConnectedAuthenticatedApp connected onLogout={() => {}} />);
    expect(screen.getByText('Checking session')).toBeTruthy();
    expect(sync.syncStart).not.toHaveBeenCalled();
    expect(refreshHostingAuth).toHaveBeenCalledWith({
      authType: 'hosted',
      force: true,
    });

    await act(async () => finishCheck('expired'));
    expect(screen.getByText('Reconnect session')).toBeTruthy();
    expect(sync.syncStart).not.toHaveBeenCalled();
  });

  it('returns to reconnect when the post-OTP check expires again', async () => {
    jest.mocked(refreshHostingAuth).mockResolvedValue('expired');
    render(<ConnectedAuthenticatedApp connected onLogout={() => {}} />);
    await act(async () => {});
    expect(screen.getByText('Reconnect session')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Reconnect session'));
    });
    expect(refreshHostingAuth).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Reconnect session')).toBeTruthy();
    expect(screen.queryByText('Checking session')).toBeNull();
    expect(sync.syncStart).not.toHaveBeenCalled();
  });

  it('waits for a fresh check when connectivity changes during a request', async () => {
    let finishOldCheck!: (result: 'unknown') => void;
    jest
      .mocked(refreshHostingAuth)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOldCheck = resolve;
          })
      )
      .mockResolvedValueOnce('expired');
    const view = render(
      <ConnectedAuthenticatedApp connected onLogout={() => {}} />
    );
    view.rerender(
      <ConnectedAuthenticatedApp
        connected={false}
        onLogout={() => {}}
        authenticatedContent={<Text>Offline</Text>}
      />
    );
    view.rerender(<ConnectedAuthenticatedApp connected onLogout={() => {}} />);
    expect(sync.syncStart).not.toHaveBeenCalled();

    await act(async () => finishOldCheck('unknown'));
    expect(refreshHostingAuth).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Reconnect session')).toBeTruthy();
    expect(sync.syncStart).not.toHaveBeenCalled();
  });
});
