// Copyright 2024, Tlon Corporation
import { TooltipProvider } from '@radix-ui/react-tooltip';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { checkDb, useMigrations } from '@tloncorp/app/lib/webDb';
import { RootStack } from '@tloncorp/app/navigation/RootStack';
import { Provider as TamaguiProvider } from '@tloncorp/app/provider';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import { sync } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/dist/store';
import cookies from 'browser-cookies';
import { usePostHog } from 'posthog-js/react';
import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EyrieMenu from '@/eyrie/EyrieMenu';
import { ANALYTICS_DEFAULT_PROPERTIES } from '@/logic/analytics';
import useAppUpdates, { AppUpdateContext } from '@/logic/useAppUpdates';
import useErrorHandler from '@/logic/useErrorHandler';
import useIsStandaloneMode from '@/logic/useIsStandaloneMode';
import { useIsDark } from '@/logic/useMedia';
import { preSig } from '@/logic/utils';
import { toggleDevTools, useLocalState, useShowDevTools } from '@/state/local';
import { useAnalyticsId, useLogActivity, useTheme } from '@/state/settings';

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

function AppRoutes({ isLoaded }: { isLoaded: boolean }) {
  const contactsQuery = store.useContacts();
  const currentUserId = useCurrentUserId();
  const calmSettingsQuery = store.useCalmSettings({ userId: currentUserId });

  useEffect(() => {
    const { data, refetch, isRefetching, isFetching } = contactsQuery;

    if (isLoaded && data?.length === 0 && !isRefetching && !isFetching) {
      refetch();
    }
  }, [contactsQuery, isLoaded]);

  useEffect(() => {
    const { data, refetch, isRefetching, isFetching } = calmSettingsQuery;

    if (isLoaded && !data && !isRefetching && !isFetching) {
      refetch();
    }
  }, [calmSettingsQuery, isLoaded]);

  const isDarkMode = useIsDarkMode();

  const navigationContainerRef = useNavigationContainerRef();

  if (!isLoaded) {
    return null;
  }

  return (
    <AppDataProvider>
      <NavigationContainer
        theme={isDarkMode ? DarkTheme : DefaultTheme}
        ref={navigationContainerRef}
      >
        <RootStack />
      </NavigationContainer>
    </AppDataProvider>
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
  const handleError = useErrorHandler();
  const isDarkMode = useIsDark();
  const currentUserId = useCurrentUserId();
  const [dbIsLoaded, setDbIsLoaded] = useState(false);
  const [startedSync, setStartedSync] = useState(false);
  const configureClient = useConfigureUrbitClient();

  useEffect(() => {
    handleError(() => {
      checkIfLoggedIn();
    })();
  }, [handleError]);

  useEffect(() => {
    configureClient({
      shipName: currentUserId,
      shipUrl: '',
    });
    const syncStart = async () => {
      await sync.syncStart(startedSync);
      setStartedSync(true);

      // we need to check the size of the database here to see if it's not zero
      // if it's not zero, set the dbIsLoaded to true
      // this is necessary because we load a fresh db on every load and we
      // can't be sure of when data has been loaded

      for (let i = 0; i < 10; i++) {
        if (dbIsLoaded) {
          break;
        }

        const { databaseSizeBytes } = (await checkDb()) || {
          databaseSizeBytes: 0,
        };

        if (databaseSizeBytes && databaseSizeBytes > 0) {
          setDbIsLoaded(true);
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };

    syncStart();
  }, [dbIsLoaded, currentUserId, startedSync]);

  return (
    <div className="flex h-full w-full flex-col">
      <MigrationCheck>
        <SafeAreaProvider>
          <TamaguiProvider defaultTheme={isDarkMode ? 'dark' : 'light'}>
            <AppRoutes isLoaded={dbIsLoaded} />
          </TamaguiProvider>
        </SafeAreaProvider>
      </MigrationCheck>
    </div>
  );
});

function RoutedApp() {
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
    <>
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
    </>
  );
}

export default RoutedApp;
