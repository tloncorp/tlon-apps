// Copyright 2024, Tlon Corporation
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { Provider as TamaguiProvider } from '@tloncorp/app/provider';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import { sync } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/dist/api';
import cookies from 'browser-cookies';
import { usePostHog } from 'posthog-js/react';
import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigateFunction,
  Route,
  BrowserRouter as Router,
  Routes,
  useNavigate,
} from 'react-router-dom';

import { ActivityScreenController } from '@/controllers/ActivityScreenController';
import { ChannelScreenController } from '@/controllers/ChannelScreenController';
import { ChatListScreenController } from '@/controllers/ChatListScreenController';
import { GroupChannelsScreenController } from '@/controllers/GroupChannelsScreenController';
import ImageViewerScreenController from '@/controllers/ImageViewerScreenController';
import { PostScreenController } from '@/controllers/PostScreenController';
import { ProfileScreenController } from '@/controllers/ProfileScreenController';
import EyrieMenu from '@/eyrie/EyrieMenu';
import { useMigrations } from '@/lib/webDb';
import { ANALYTICS_DEFAULT_PROPERTIES } from '@/logic/analytics';
import useAppUpdates, { AppUpdateContext } from '@/logic/useAppUpdates';
import useErrorHandler from '@/logic/useErrorHandler';
import useIsStandaloneMode from '@/logic/useIsStandaloneMode';
import { useIsDark } from '@/logic/useMedia';
import { preSig } from '@/logic/utils';
import { toggleDevTools, useLocalState, useShowDevTools } from '@/state/local';
import { useAnalyticsId, useLogActivity, useTheme } from '@/state/settings';

import { AppInfoScreenController } from './controllers/AppInfoScreenController';
import { AppSettingsScreenController } from './controllers/AppSettingsScreenController';
import { BlockedUsersScreenController } from './controllers/BlockedUsersScreenController';
import { ChannelMembersScreenController } from './controllers/ChannelMembersScreenController';
import { ChannelSearchScreenController } from './controllers/ChannelSearchScreenController';
import { EditChannelScreenController } from './controllers/EditChannelScreenController';
import { EditProfileScreenController } from './controllers/EditProfileScreenController';
import { FeatureFlagScreenController } from './controllers/FeatureFlagScreenController';
import { GroupMembersScreenController } from './controllers/GroupMembersScreenController';
import { GroupMetaScreenController } from './controllers/GroupMetaScreenController';
import { GroupPrivacyScreenController } from './controllers/GroupPrivacyScreenController';
import { GroupRolesScreenController } from './controllers/GroupRolesScreenController';
import { ManageAccountScreenController } from './controllers/ManageAccountScreenController';
import { ManageChannelsScreenController } from './controllers/ManageChannelsScreenController';
import { PushNotificationSettingsScreenController } from './controllers/PushNotificationSettingsScreenController';
import { UserBugReportScreenController } from './controllers/UserBugReportScreenController';
import UserProfileScreenController from './controllers/UserProfileScreenController';

const ReactQueryDevtoolsProduction = React.lazy(() =>
  import('@tanstack/react-query-devtools/build/lib/index.prod.js').then(
    (d) => ({
      default: d.ReactQueryDevtools,
    })
  )
);

function authRedirect() {
  document.location = `${document.location.protocol}//${document.location.host}`;
}

function checkIfLoggedIn() {
  if (!('ship' in window)) {
    authRedirect();
  }

  const session = cookies.get(`urbauth-~${window.ship}`);
  if (!session) {
    fetch('/~/name')
      .then((res) => res.text())
      .then((name) => {
        if (name !== preSig(window.ship)) {
          authRedirect();
        }
      })
      .catch(() => {
        authRedirect();
      });
  }
}

function handleGridRedirect(navigate: NavigateFunction) {
  const query = new URLSearchParams(window.location.search);

  if (query.has('landscape-note')) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    navigate(decodeURIComponent(query.get('landscape-note')!));
  } else if (query.has('grid-link')) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    navigate(decodeURIComponent(query.get('landscape-link')!));
  }
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ChatListScreenController />} />
      <Route path="/activity" element={<ActivityScreenController />} />
      <Route
        path="/group/:ship/:name"
        index
        element={<GroupChannelsScreenController />}
      />
      <Route
        path="/group/:ship/:name/members"
        element={<GroupMembersScreenController />}
      />
      <Route
        path="/group/:ship/:name/meta"
        element={<GroupMetaScreenController />}
      />
      <Route
        path="/group/:ship/:name/privacy"
        element={<GroupPrivacyScreenController />}
      />
      <Route
        path="/group/:ship/:name/roles"
        element={<GroupRolesScreenController />}
      />
      <Route
        path="/group/:ship/:name/manage-channels"
        element={<ManageChannelsScreenController />}
      />
      <Route
        path="/group/:ship/:name/channel/:chType/:chShip/:chName/post/:authorId/:postId"
        element={<PostScreenController />}
      />
      <Route
        path="/dm/:chShip/post/:authorId/:postId"
        element={<PostScreenController />}
      />
      <Route path="/dm/:chShip" element={<ChannelScreenController />} />
      <Route
        path="/group/:ship/:name/channel/:chType/:chShip/:chName/:postId?"
        element={<ChannelScreenController />}
      />
      <Route
        path="/image/:postId/:uri"
        element={<ImageViewerScreenController />}
      />
      <Route
        path="/dm/:chShip/members"
        element={<ChannelMembersScreenController />}
      />
      <Route
        path="/dm/:chShip/meta"
        element={<ChannelMembersScreenController />}
      />
      <Route
        path="/group/:ship/:name/channel/:chType/:chShip/:chName/search"
        element={<ChannelSearchScreenController />}
      />
      <Route
        path="/dm/:chShip/search"
        element={<ChannelSearchScreenController />}
      />
      <Route
        path="/group/:ship/:name/channel/:chType/:chShip/:chName/edit"
        element={<EditChannelScreenController />}
      />
      <Route path="/profile" element={<ProfileScreenController />} />
      <Route
        path="/profile/:userId"
        element={<UserProfileScreenController />}
      />
      <Route path="/profile/edit" element={<EditProfileScreenController />} />
      <Route path="/settings" element={<AppSettingsScreenController />} />
      <Route path="/settings/app-info" element={<AppInfoScreenController />} />
      <Route
        path="/settings/feature-flags"
        element={<FeatureFlagScreenController />}
      />
      <Route
        path="/settings/manage-account"
        element={<ManageAccountScreenController />}
      />
      <Route
        path="/settings/push-notifications"
        element={<PushNotificationSettingsScreenController />}
      />
      <Route
        path="/settings/blocked-users"
        element={<BlockedUsersScreenController />}
      />
      <Route path="/bug-report" element={<UserBugReportScreenController />} />
    </Routes>
  );
}

function MigrationCheck({ children }: PropsWithChildren) {
  const { success, error } = useMigrations();
  if (!success && !error) {
    return null;
  }
  if (error) {
    throw error;
  }
  return <>{children}</>;
}

const App = React.memo(function AppComponent() {
  const navigate = useNavigate();
  const handleError = useErrorHandler();
  const isDarkMode = useIsDark();

  useEffect(() => {
    handleError(() => {
      checkIfLoggedIn();
      handleGridRedirect(navigate);
    })();
  }, [handleError, navigate]);

  useEffect(() => {
    api.configureClient({
      shipName: window.our,
      shipUrl: '',
      onReset: () => sync.syncStart(),
      onChannelReset: () => sync.handleDiscontinuity(),
    });
    sync.syncStart();
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <MigrationCheck>
        <AppDataProvider>
          <SafeAreaProvider>
            <TamaguiProvider defaultTheme={isDarkMode ? 'dark' : 'light'}>
              <AppRoutes />
            </TamaguiProvider>
          </SafeAreaProvider>
        </AppDataProvider>
      </MigrationCheck>
    </div>
  );
});

function RoutedApp() {
  const mode = import.meta.env.MODE;
  const [userThemeColor, setUserThemeColor] = useState('#ffffff');
  const showDevTools = useShowDevTools();
  const isStandAlone = useIsStandaloneMode();
  const logActivity = useLogActivity();
  const posthog = usePostHog();
  const analyticsId = useAnalyticsId();
  const { needsUpdate, triggerUpdate } = useAppUpdates();
  const body = document.querySelector('body');
  const colorSchemeFromNative =
    window.nativeOptions?.colorScheme ?? window.colorscheme;

  const appUpdateContextValue = useMemo(
    () => ({ needsUpdate, triggerUpdate }),
    [needsUpdate, triggerUpdate]
  );

  const basename = () => {
    if (mode === 'mock' || mode === 'staging') {
      return '/';
    }

    return '/apps/groups';
  };

  const theme = useTheme();
  const isDarkMode = useIsDark();

  useEffect(() => {
    const onFocus = () => {
      useLocalState.setState({ inFocus: true });
    };
    window.addEventListener('focus', onFocus);

    const onBlur = () => {
      useLocalState.setState({ inFocus: false });
    };
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    window.toggleDevTools = () => toggleDevTools();
  }, []);

  useEffect(() => {
    if (
      (isDarkMode && theme === 'auto') ||
      theme === 'dark' ||
      colorSchemeFromNative === 'dark'
    ) {
      document.body.classList.add('dark');
      useLocalState.setState({ currentTheme: 'dark' });
      setUserThemeColor('#000000');
    } else {
      document.body.classList.remove('dark');
      useLocalState.setState({ currentTheme: 'light' });
      setUserThemeColor('#ffffff');
    }
  }, [isDarkMode, theme, colorSchemeFromNative]);

  useEffect(() => {
    if (isStandAlone) {
      // this is necessary for the desktop PWA to not have extra padding at the bottom.
      body?.style.setProperty('padding-bottom', '0px');
    }
  }, [isStandAlone, body]);

  useEffect(() => {
    if (posthog && analyticsId !== '' && logActivity) {
      posthog.identify(analyticsId, ANALYTICS_DEFAULT_PROPERTIES);
    }
  }, [posthog, analyticsId, logActivity]);

  useEffect(() => {
    if (posthog) {
      if (showDevTools) {
        posthog.debug();
      } else {
        posthog.debug(false);
      }
    }
  }, [posthog, showDevTools]);

  return (
    <Router basename={basename()}>
      <Helmet>
        <title>Tlon</title>
        <meta name="theme-color" content={userThemeColor} />
      </Helmet>
      <AppUpdateContext.Provider value={appUpdateContextValue}>
        <TooltipProvider delayDuration={0} skipDelayDuration={400}>
          <App />
        </TooltipProvider>
      </AppUpdateContext.Provider>
      {showDevTools && (
        <>
          <React.Suspense fallback={null}>
            <ReactQueryDevtoolsProduction />
          </React.Suspense>
          <div className="fixed bottom-4 right-4">
            <EyrieMenu />
          </div>
        </>
      )}
    </Router>
  );
}

export default RoutedApp;
