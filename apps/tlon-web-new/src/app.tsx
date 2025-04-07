// Copyright 2025, Tlon Corporation
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { ShipProvider } from '@tloncorp/app/contexts/ship';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import useDesktopNotifications from '@tloncorp/app/hooks/useDesktopNotifications';
import { useFindSuggestedContacts } from '@tloncorp/app/hooks/useFindSuggestedContacts';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { useTelemetry } from '@tloncorp/app/hooks/useTelemetry';
import { BasePathNavigator } from '@tloncorp/app/navigation/BasePathNavigator';
import {
  getDesktopLinkingConfig,
  getMobileLinkingConfig,
} from '@tloncorp/app/navigation/linking';
import { Provider as TamaguiProvider } from '@tloncorp/app/provider';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import { LoadingSpinner, StoreProvider, View } from '@tloncorp/app/ui';
import { getAuthInfo } from '@tloncorp/shared';
import { sync } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Text } from '@tloncorp/ui';
import cookies from 'browser-cookies';
import { usePostHog } from 'posthog-js/react';
import React, { PropsWithChildren, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EyrieMenu from '@/eyrie/EyrieMenu';
import useAppUpdates from '@/logic/useAppUpdates';
import useErrorHandler from '@/logic/useErrorHandler';
import useIsStandaloneMode from '@/logic/useIsStandaloneMode';
import { useIsDark, useIsMobile } from '@/logic/useMedia';
import { preSig } from '@/logic/utils';
import { toggleDevTools, useLocalState, useShowDevTools } from '@/state/local';
import { useAnalyticsId, useLogActivity, useTheme } from '@/state/settings';

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

function AppRoutes() {
  const contactsQuery = store.useContacts();
  const currentUserId = useCurrentUserId();
  const { needsUpdate, triggerUpdate } = useAppUpdates();
  const [currentRoute, setCurrentRoute] = useState<any>(null);

  const { data: channelData } = store.useChannel({
    id: currentRoute?.params?.channelId,
  });
  const { data: groupData } = store.useGroup({
    id: currentRoute?.params?.groupId,
  });

  useEffect(() => {
    const { data, refetch, isRefetching, isFetching } = contactsQuery;

    if (data?.length === 0 && !isRefetching && !isFetching) {
      refetch();
    }
  }, [contactsQuery]);

  const isMobile = useIsMobile();
  const isDarkMode = useIsDarkMode();

  const getFriendlyName = (routeName: string) => {
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
  };

  return (
    <AppDataProvider
      webAppNeedsUpdate={needsUpdate}
      triggerWebAppUpdate={triggerUpdate}
    >
      {isMobile ? (
        <NavigationContainer
          linking={getMobileLinkingConfig(import.meta.env.MODE)}
          theme={isDarkMode ? DarkTheme : DefaultTheme}
          onStateChange={(state) => {
            if (state) {
              const route = state.routes[state.index];
              const nestedRoute = route.state?.routes[route.state?.index || 0];
              if (nestedRoute) {
                setCurrentRoute(nestedRoute);
              }
            }
          }}
          documentTitle={{
            enabled: true,
            formatter: (options, route) => {
              if (!route?.name) return 'Tlon';

              if (route.name === 'GroupChannels') {
                if (groupData) {
                  return `${groupData.title}`;
                }
                return 'Group Channels';
              }

              // For channel routes
              if (route.name === 'Channel' || route.name === 'ChannelRoot') {
                if (channelData && groupData) {
                  return `${channelData.title} - ${groupData.title}`;
                }
              }

              // For DM routes
              if (route.name === 'DM') {
                if (channelData) {
                  const title =
                    channelData.title ||
                    channelData.contact?.peerNickname ||
                    channelData.contact?.customNickname ||
                    channelData.contactId ||
                    'Chat';
                  return `${title}`;
                }
                return 'Chat';
              }

              // For Group DM routes
              if (route.name === 'GroupDM') {
                if (channelData) {
                  return `${channelData.title !== '' ? channelData.title : 'Group DM'}`;
                }
                return 'Group DM';
              }

              // For other routes
              const screenName = getFriendlyName(route.name);
              return `${screenName}`;
            },
          }}
        >
          <BasePathNavigator isMobile={isMobile} />
        </NavigationContainer>
      ) : (
        <NavigationContainer
          linking={getDesktopLinkingConfig(import.meta.env.MODE)}
          theme={isDarkMode ? DarkTheme : DefaultTheme}
          onStateChange={(state) => {
            if (state) {
              const route = state.routes[state.index];
              const nestedRoute = route.state?.routes[route.state?.index || 0];
              if (
                nestedRoute &&
                (nestedRoute.name === 'Home' || nestedRoute.name === 'Messages')
              ) {
                const nestedHomeRoute =
                  nestedRoute.state?.routes[nestedRoute.state?.index || 0];
                if (nestedHomeRoute) {
                  setCurrentRoute(nestedHomeRoute);
                }
              }
            }
          }}
          documentTitle={{
            enabled: true,
            formatter: (options, route) => {
              if (!route?.name) return 'Tlon';

              // For channel routes
              if (route.name === 'Channel' || route.name === 'ChannelRoot') {
                if (channelData && groupData) {
                  if (groupData?.title) {
                    return `${channelData.title} - ${groupData.title}`;
                  } else {
                    return `${channelData.title}`;
                  }
                }
                if (channelData) {
                  const title =
                    channelData.title ||
                    channelData.contact?.peerNickname ||
                    channelData.contact?.customNickname ||
                    channelData.contactId ||
                    'Chat';
                  return `${title}`;
                }
                return 'Chat';
              }

              // For other routes
              const screenName = getFriendlyName(route.name);
              return `${screenName}`;
            },
          }}
        >
          <BasePathNavigator isMobile={isMobile} />
        </NavigationContainer>
      )}
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
  useFindSuggestedContacts();
  useDesktopNotifications(clientReady);

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
          setClientReady(true);
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
  const telemetry = useTelemetry();
  useFindSuggestedContacts();

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
  }, [dbIsLoaded, currentUserId, configureClient, session]);

  if (!dbIsLoaded) {
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
          <Text marginTop="$xl" size="$label/s">
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

  return (
    <div className="flex h-full w-full flex-col">
      <ShipProvider>
        <MigrationCheck>
          <SafeAreaProvider>
            <TamaguiProvider defaultTheme={isDarkMode ? 'dark' : 'light'}>
              <StoreProvider>
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
                        <Text
                          color="$primaryText"
                          marginTop="$xl"
                          fontSize="$s"
                        >
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
              </StoreProvider>
            </TamaguiProvider>
          </SafeAreaProvider>
        </MigrationCheck>
      </ShipProvider>
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
      <App />
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
