// Copyright 2025, Tlon Corporation
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  NavigationState,
  PartialState,
  Route,
} from '@react-navigation/native';
import { ENABLED_LOGGERS } from '@tloncorp/app/constants';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import useDesktopNotifications from '@tloncorp/app/hooks/useDesktopNotifications';
import { useFindSuggestedContacts } from '@tloncorp/app/hooks/useFindSuggestedContacts';
import { useInviteParam } from '@tloncorp/app/hooks/useInviteParam';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { useRenderCount } from '@tloncorp/app/hooks/useRenderCount';
import { useTelemetry } from '@tloncorp/app/hooks/useTelemetry';
import {
  SplashScreenTask,
  splashScreenProgress,
} from '@tloncorp/app/lib/splashscreen';
import { BasePathNavigator } from '@tloncorp/app/navigation/BasePathNavigator';
import {
  getNavigationIntentFromState,
  getStateFromNavigationIntent,
} from '@tloncorp/app/navigation/intent';
import {
  getDesktopLinkingConfig,
  getMobileLinkingConfig,
} from '@tloncorp/app/navigation/linking';
import { CombinedParamList } from '@tloncorp/app/navigation/types';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import { BaseProviderStack } from '@tloncorp/app/provider/BaseProviderStack';
import {
  ForwardPostSheetProvider,
  LoadingSpinner,
  Text,
  View,
} from '@tloncorp/app/ui';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  getAuthInfo,
} from '@tloncorp/shared';
import { sync } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useEventEmitter } from '@tloncorp/shared/utils';
import cookies from 'browser-cookies';
import { usePostHog } from 'posthog-js/react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Helmet } from 'react-helmet';

import EyrieMenu from '@/eyrie/EyrieMenu';
import useAppUpdates from '@/logic/useAppUpdates';
import useErrorHandler from '@/logic/useErrorHandler';
import useIsStandaloneMode from '@/logic/useIsStandaloneMode';
import { useIsDark, useIsMobile } from '@/logic/useMedia';
import { preSig } from '@/logic/utils';
import { toggleDevTools, useLocalState, useShowDevTools } from '@/state/local';
import { useTheme } from '@/state/settings';

import { DesktopLoginScreen } from './components/DesktopLoginScreen';
import { isElectron } from './electron-bridge';

// Conditionally import the appropriate database functions
const { checkDb, useMigrations } = isElectron()
  ? await import('@tloncorp/app/lib/electronDb')
  : await import('@tloncorp/app/lib/webDb');

const ReactQueryDevtoolsProduction = React.lazy(() =>
  import('@tanstack/react-query-devtools/production').then((d) => ({
    default: d.ReactQueryDevtools,
  }))
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

function getFriendlyName(routeName: string) {
  const friendlyNames: Record<string, string> = {
    ChatList: 'Home',
    GroupSettings: 'Group Settings',
    ChannelSearch: 'Search',
    ChatDetails: 'Chat Details',
    UserProfile: 'Profile',
    AppSettings: 'Settings',
    ManageAccount: 'Account',
    BlockedUsers: 'Blocked Users',
    FeatureFlags: 'Features',
    PushNotificationSettings: 'Notifications',
  };

  return (
    friendlyNames[routeName] || routeName.replace(/([A-Z])/g, ' $1').trim()
  );
}

const extractNestedRouteMobile = (state: any) => {
  if (!state) return null;
  const route = state.routes[state.index];
  return route.state?.routes[route.state?.index || 0] || null;
};

const extractNestedRouteDesktop = (state: any) => {
  if (!state) return null;
  const route = state.routes[state.index];
  const nestedRoute = route.state?.routes[route.state?.index || 0];

  if (
    nestedRoute &&
    (nestedRoute.name === 'Home' || nestedRoute.name === 'Messages')
  ) {
    return nestedRoute.state?.routes[nestedRoute.state?.index || 0] || null;
  }
  return null;
};

function AppRoutes() {
  useFindSuggestedContacts();
  const contactsQuery = store.useContacts();
  const { needsUpdate, triggerUpdate } = useAppUpdates();
  const [currentRouteParams, setCurrentRouteParams] = useState<any>(null);
  const currentRouteRef = useRef<any>(null);

  const channelId = useMemo(
    () => currentRouteParams?.channelId,
    [currentRouteParams?.channelId]
  );
  const groupId = useMemo(
    () => currentRouteParams?.groupId,
    [currentRouteParams?.groupId]
  );

  const { data: channelData } = store.useChannel({
    id: channelId,
  });
  const { data: groupData } = store.useGroup({
    id: groupId,
  });

  const isMobile = useIsMobile();
  const isDarkMode = useIsDarkMode();
  const theme = useMemo(() => {
    if (isDarkMode) {
      return DarkTheme;
    }
    return DefaultTheme;
  }, [isDarkMode]);

  useRenderCount('AppRoutes');

  const handleStateChangeMobile = useCallback((state: any) => {
    const nestedRoute = extractNestedRouteMobile(state);
    if (nestedRoute) {
      // Only update state if needed for specific param changes
      if (
        nestedRoute.params?.channelId !==
          currentRouteRef.current?.params?.channelId ||
        nestedRoute.params?.groupId !== currentRouteRef.current?.params?.groupId
      ) {
        setCurrentRouteParams(nestedRoute.params);
      }
      currentRouteRef.current = nestedRoute;
    }
  }, []);

  const handleStateChangeDesktop = useCallback((state: any) => {
    const nestedRoute = extractNestedRouteDesktop(state);
    if (nestedRoute) {
      // Only update state if needed for specific param changes
      if (
        nestedRoute.params?.channelId !==
          currentRouteRef.current?.params?.channelId ||
        nestedRoute.params?.groupId !== currentRouteRef.current?.params?.groupId
      ) {
        setCurrentRouteParams(nestedRoute.params);
      }
      currentRouteRef.current = nestedRoute;
    }
  }, []);

  const documentTitleFormatterMobile = useCallback(
    (_options: any, route: Route<string>) => {
      if (!route?.name) return 'Tlon';

      if (route.name === 'GroupChannels') {
        if (groupData?.title) {
          return `${groupData.title}`;
        }
        return 'Group Channels';
      }

      // For channel routes
      if (route.name === 'Channel' || route.name === 'ChannelRoot') {
        if (channelData?.title && groupData?.title) {
          return `${channelData.title} - ${groupData.title}`;
        }
      }

      // For DM routes
      if (route.name === 'DM') {
        const title =
          channelData?.title ||
          channelData?.contact?.peerNickname ||
          channelData?.contact?.customNickname ||
          channelData?.contactId ||
          'Chat';
        return `${title}`;
      }

      // For Group DM routes
      if (route.name === 'GroupDM') {
        return `${channelData?.title ?? 'Group DM'}`;
      }

      // For other routes
      const screenName = getFriendlyName(route.name);
      return `${screenName}`;
    },
    [
      groupData?.title,
      channelData?.title,
      channelData?.contact?.peerNickname,
      channelData?.contact?.customNickname,
      channelData?.contactId,
    ]
  );

  const documentTitleFormatterDesktop = useCallback(
    (_options: any, route: Route<string>) => {
      if (!route?.name) return 'Tlon';

      // For channel routes
      if (
        route.name === 'Channel' ||
        route.name === 'ChannelRoot' ||
        route.name === 'DM' // we are briefly routed to DM before going to ChannelRoot
      ) {
        if (groupData?.title && channelData?.title) {
          return `${channelData.title} - ${groupData.title}`;
        }

        const title =
          channelData?.title ||
          channelData?.contact?.peerNickname ||
          channelData?.contact?.customNickname ||
          channelData?.contactId ||
          'Chat';
        return title;
      }

      // For other routes
      const screenName = getFriendlyName(route.name);
      return screenName;
    },
    [
      groupData?.title,
      channelData?.title,
      channelData?.contact?.peerNickname,
      channelData?.contact?.customNickname,
      channelData?.contactId,
    ]
  );

  const mobileLinkingConfig = useMemo(
    () => getMobileLinkingConfig(import.meta.env.MODE),
    []
  );

  const desktopLinkingConfig = useMemo(
    () => getDesktopLinkingConfig(import.meta.env.MODE),
    []
  );

  const { onNavigationStateChange, initialStateRef } = useDeriveInitialNavState(
    isMobile ? 'mobile' : 'desktop'
  );

  const platformHandleStateChange = isMobile
    ? handleStateChangeMobile
    : handleStateChangeDesktop;
  const combinedStateChangeHandler = useCallback(
    (state: NavigationState<CombinedParamList> | undefined) => {
      platformHandleStateChange(state);
      onNavigationStateChange(state);
    },
    [platformHandleStateChange, onNavigationStateChange]
  );

  return (
    <AppDataProvider
      webAppNeedsUpdate={needsUpdate}
      triggerWebAppUpdate={triggerUpdate}
    >
      <ForwardPostSheetProvider>
        {isMobile ? (
          <NavigationContainer
            key="mobile"
            initialState={initialStateRef.current.mobile}
            linking={mobileLinkingConfig}
            theme={theme}
            onStateChange={combinedStateChangeHandler}
            documentTitle={{
              enabled: true,
              formatter: documentTitleFormatterMobile,
            }}
          >
            <BasePathNavigator isMobile={true} />
          </NavigationContainer>
        ) : (
          <NavigationContainer
            key="desktop"
            initialState={initialStateRef.current.desktop}
            linking={desktopLinkingConfig}
            theme={theme}
            onStateChange={combinedStateChangeHandler}
            documentTitle={{
              enabled: true,
              formatter: documentTitleFormatterDesktop,
            }}
          >
            <BasePathNavigator isMobile={false} />
          </NavigationContainer>
        )}
      </ForwardPostSheetProvider>
    </AppDataProvider>
  );
}

function ConnectedDesktopApp({
  ship,
  shipUrl,
  authCookie,
}: {
  ship: string;
  shipUrl: string;
  authCookie: string;
}) {
  const [clientReady, setClientReady] = useState(false);
  const configureClient = useConfigureUrbitClient();
  const hasSyncedRef = React.useRef(false);
  useDesktopNotifications(clientReady);

  useEffect(() => {
    splashScreenProgress.emitter.on('complete', () => {
      setClientReady(true);
    });
  }, []);

  useEffect(() => {
    window.ship = ship;
    window.our = ship;

    const initializeClient = async () => {
      store.removeClient();

      configureClient({
        shipName: ship,
        shipUrl,
      });

      if (!hasSyncedRef.current) {
        try {
          await sync.syncStart(false);
          splashScreenProgress.complete(SplashScreenTask.initialSync);
          hasSyncedRef.current = true;
        } catch (e) {
          console.error('Error starting sync:', e);
          setClientReady(false);
        }
      }
    };

    initializeClient();
  }, [configureClient, ship, shipUrl, authCookie]);

  if (!clientReady) {
    return (
      <View
        height="100%"
        width="100%"
        justifyContent="center"
        alignItems="center"
        backgroundColor="$secondaryBackground"
      >
        <View
          backgroundColor="$background"
          padding="$xl"
          borderRadius="$l"
          aspectRatio={1}
          alignItems="center"
          justifyContent="center"
          borderWidth={1}
          borderColor="$border"
        >
          <LoadingSpinner color="$primaryText" />
          <Text color="$primaryText" marginTop="$xl" fontSize="$s">
            Starting up&hellip;
          </Text>
        </View>
      </View>
    );
  }

  return <AppRoutes />;
}

function ConnectedWebApp() {
  const currentUserId = useCurrentUserId();
  const [dbIsLoaded, setDbIsLoaded] = useState(false);
  const configureClient = useConfigureUrbitClient();
  const session = store.useCurrentSession();
  const hasSyncedRef = React.useRef(false);
  const hasHandledWayfindingRef = React.useRef(false);
  const telemetry = useTelemetry();
  useFindSuggestedContacts();

  const isNewSignup = useMemo(() => {
    return logic.detectWebSignup();
  }, []);

  useEffect(() => {
    configureClient({
      shipName: currentUserId,
      shipUrl: '',
    });

    const syncStart = async () => {
      // Only call sync.syncStart once during the app's lifecycle
      if (!hasSyncedRef.current) {
        // Web doesn't persist database, so headsSyncedAt is misleading
        await db.headsSyncedAt.resetValue();
        sync.syncStart(false);
        hasSyncedRef.current = true;
        telemetry.captureAppActive('web');
      }

      if (!session?.startTime) {
        return;
      }

      // for new users, make sure the wayfinding tutorial is ready before
      // showing the app
      if (!hasHandledWayfindingRef.current) {
        const personalGroup = await db.getPersonalGroup();
        const personalGroupReady = !!personalGroup;
        const allGroups = await db.getGroups({ includeUnjoined: false });
        const hasFewGroups = allGroups.length < 4; // arbitrary "new user" threshold
        if (isNewSignup || hasFewGroups) {
          try {
            if (!personalGroupReady) {
              await logic.withRetry(() => store.scaffoldPersonalGroup(), {
                numOfAttempts: 3,
              });
            }
            // only show coach marks if we're confident they're a new user
            if (isNewSignup) {
              db.wayfindingProgress.setValue((prev) => ({
                ...prev,
                tappedChatInput: false,
                tappedAddCollection: false,
                tappedAddNote: false,
              }));
            }
          } catch (e) {
            telemetry.capture(AnalyticsEvent.ErrorWayfinding, {
              context: 'failed to scaffold personal group',
              during: 'web start sequence',
              errorMessage: e.message,
              errorStack: e.stack,
              severity: AnalyticsSeverity.Critical,
            });
          } finally {
            hasHandledWayfindingRef.current = true;
          }
        }
      }

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
          splashScreenProgress.complete(SplashScreenTask.startDatabase);
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };

    syncStart();
  }, [
    dbIsLoaded,
    currentUserId,
    configureClient,
    session?.startTime,
    isNewSignup,
    telemetry,
  ]);

  useRenderCount('ConnectedWebApp');

  const hideSplashScreen = useEventEmitter(
    splashScreenProgress.emitter,
    'complete',
    useCallback(() => true, []),
    splashScreenProgress.finished
  );

  if (!hideSplashScreen) {
    return (
      <View
        height="100%"
        width="100%"
        justifyContent="center"
        alignItems="center"
        backgroundColor="$secondaryBackground"
      >
        <View
          backgroundColor="$background"
          padding="$xl"
          borderRadius="$l"
          aspectRatio={1}
          alignItems="center"
          justifyContent="center"
          borderWidth={1}
          borderColor="$border"
        >
          <LoadingSpinner color="$primaryText" />
          <Text color="$primaryText" marginTop="$xl" fontSize="$s">
            Starting up&hellip;
          </Text>
        </View>
      </View>
    );
  }

  return <AppRoutes />;
}

const App = React.memo(function AppComponent() {
  const handleError = useErrorHandler();
  const isDarkMode = useIsDark();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authParams, setAuthParams] = useState<{
    ship: string;
    shipUrl: string;
    authCookie: string;
  } | null>(null);

  // Check login for web
  useEffect(() => {
    if (!isElectron()) {
      handleError(() => {
        checkIfLoggedIn();
      })();
      setIsLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    if (isElectron()) {
      const checkStoredAuth = async () => {
        try {
          const storedAuth = await getAuthInfo();
          if (storedAuth) {
            console.log(
              'Found stored auth credentials for ship:',
              storedAuth.ship
            );
            setAuthParams(storedAuth);
            setIsAuthenticated(true);
          }
        } catch (error) {
          console.error('Error loading stored auth:', error);
        } finally {
          setIsLoading(false);
        }
      };

      checkStoredAuth();
    }
  }, []);

  const migrationState = useMigrations();

  const defaultTheme = useMemo(() => {
    return isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        flexDirection: 'column',
      }}
    >
      <BaseProviderStack
        migrationState={migrationState}
        tamaguiState={{ defaultTheme }}
      >
        {isElectron() ? (
          isLoading ? (
            <View
              height="100%"
              width="100%"
              justifyContent="center"
              alignItems="center"
              backgroundColor="$secondaryBackground"
            >
              <View
                backgroundColor="$background"
                padding="$xl"
                borderRadius="$l"
                aspectRatio={1}
                alignItems="center"
                justifyContent="center"
                borderWidth={1}
                borderColor="$border"
              >
                <LoadingSpinner color="$primaryText" />
                <Text color="$primaryText" marginTop="$xl" fontSize="$s">
                  Loading saved credentials&hellip;
                </Text>
              </View>
            </View>
          ) : isAuthenticated && authParams ? (
            <ConnectedDesktopApp
              ship={authParams.ship}
              shipUrl={authParams.shipUrl}
              authCookie={authParams.authCookie}
            />
          ) : (
            <DesktopLoginScreen
              onLoginSuccess={(params) => {
                setAuthParams(params);
                setIsAuthenticated(true);
              }}
            />
          )
        ) : (
          <ConnectedWebApp />
        )}
      </BaseProviderStack>
    </div>
  );
});

function RoutedApp() {
  const [userThemeColor, setUserThemeColor] = useState('#ffffff');
  const showDevTools = useShowDevTools();
  const isStandAlone = useIsStandaloneMode();
  const posthog = usePostHog();
  const body = document.querySelector('body');
  const colorSchemeFromNative =
    window.nativeOptions?.colorScheme ?? window.colorscheme;

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
    if (posthog) {
      if (ENABLED_LOGGERS.includes('posthog')) {
        posthog.debug();
      }
    }
  }, [posthog, showDevTools]);

  return (
    <>
      <Helmet>
        <title>Tlon</title>
        <meta name="theme-color" content={userThemeColor} />
      </Helmet>
      <App />
      {showDevTools && (
        <>
          <React.Suspense fallback={null}>
            <ReactQueryDevtoolsProduction />
          </React.Suspense>
        </>
      )}
    </>
  );
}

export default RoutedApp;

const flipNavigator = (navigatorType: 'mobile' | 'desktop') =>
  navigatorType === 'mobile' ? 'desktop' : 'mobile';

/*
 * On every nav state change, derive a corresponding navigation `initialState`
 * that can be passed to a `NavigationContainer`.
 *
 * This conversion loses any history in the navigation state - this means
 * that `goBack` will not work directly after switching navigators. Supporting
 * history here seems too complex, so it's just a limitation until we have a
 * unified router.
 */
function useDeriveInitialNavState(navigatorType: 'mobile' | 'desktop') {
  const initialStateRef = useRef<
    Partial<
      Record<
        typeof navigatorType,
        | NavigationState<CombinedParamList>
        | PartialState<NavigationState<CombinedParamList>>
      >
    >
  >({});

  const onNavigationStateChange = useCallback(
    (state: NavigationState<CombinedParamList> | undefined) => {
      if (!state) {
        initialStateRef.current = {};
        return;
      }

      initialStateRef.current[navigatorType] = state;
      const navIntent = getNavigationIntentFromState(state, navigatorType);
      if (navIntent) {
        initialStateRef.current[flipNavigator(navigatorType)] =
          getStateFromNavigationIntent(
            navIntent,
            flipNavigator(navigatorType)
          ) ?? undefined;
      }
    },
    [navigatorType]
  );

  return {
    onNavigationStateChange,
    initialStateRef,
  };
}
