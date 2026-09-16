import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { Text } from 'react-native';

import ConnectedAuthenticatedApp from '../components/AuthenticatedApp';
import { refreshHostingAuth } from '../lib/hostingAuth';
import { sync } from '@tloncorp/shared';

jest.unmock('../components/AuthenticatedApp');
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
jest.mock('@tloncorp/app/navigation/RootStack', () => {
  const { Text } = require('react-native');
  return { RootStack: () => <Text>Authenticated content</Text> };
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
  sync: { syncStart: jest.fn<() => Promise<void>>() },
}));
jest.mock('@tloncorp/shared/db', () => ({
  didSyncInitialPosts: { getValue: async () => true },
  nodeStoppedWhileLoggedIn: { setValue: jest.fn() },
}));
jest.mock('@tloncorp/shared/store', () => ({
  confirmHostingAuthReconnectCode: async () => {},
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
  beforeEach(() => {
    jest.mocked(refreshHostingAuth).mockReset().mockResolvedValue('ok');
    jest.mocked(sync.syncStart).mockReset().mockResolvedValue();
  });
  afterEach(cleanup);

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
