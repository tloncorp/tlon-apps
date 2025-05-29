import { useAsyncStorageDevTools } from '@dev-plugins/async-storage';
import { useReactNavigationDevTools } from '@dev-plugins/react-navigation';
import { useReactQueryDevTools } from '@dev-plugins/react-query';
import NetInfo from '@react-native-community/netinfo';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRefWithCurrent,
  useNavigationContainerRef,
} from '@react-navigation/native';
import ErrorBoundary from '@tloncorp/app/ErrorBoundary';
import { BranchProvider } from '@tloncorp/app/contexts/branch';
import { ShipProvider, useShip } from '@tloncorp/app/contexts/ship';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { unregisterBackgroundSyncTask } from '@tloncorp/app/lib/backgroundSync';
import { useMigrations } from '@tloncorp/app/lib/nativeDb';
import { Provider as TamaguiProvider } from '@tloncorp/app/provider';
import {
  LoadingSpinner,
  PortalProvider,
  SplashSequence,
  StoreProvider,
  Text,
  View,
  usePreloadedEmojis,
} from '@tloncorp/app/ui';
import { FeatureFlagConnectedInstrumentationProvider } from '@tloncorp/app/utils/perf';
import { posthogAsync } from '@tloncorp/app/utils/posthog';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { ToastProvider } from '@tloncorp/ui';
import { setBadgeCountAsync } from 'expo-notifications';
import { PostHogProvider } from 'posthog-react-native';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OnboardingStack } from './OnboardingStack';
import AuthenticatedApp from './components/AuthenticatedApp';
import { SignupProvider, useSignupContext } from './lib/signupContext';

unregisterBackgroundSyncTask();

// Android notification tap handler passes initial params here
const App = () => {
  const isDarkMode = useIsDarkMode();
  const {
    isLoading,
    isAuthenticated,
    needsSplashSequence,
    clearNeedsSplashSequence,
  } = useShip();
  const [connected, setConnected] = useState(true);
  const signupContext = useSignupContext();

  const finishingSelfHostedLogin = db.finishingSelfHostedLogin.useValue();
  const haveHostedLogin = db.haveHostedLogin.useValue();
  const hostedAccountInitialized = db.hostedAccountIsInitialized.useValue();
  const hostedNodeRunning = db.hostedNodeIsRunning.useValue();

  const currentlyOnboarding = useMemo(() => {
    return signupContext.email || signupContext.phoneNumber;
  }, [signupContext.email, signupContext.phoneNumber]);

  usePreloadedEmojis();

  useEffect(() => {
    const unsubscribeFromNetInfo = NetInfo.addEventListener(
      ({ isConnected }) => {
        setConnected(isConnected ?? true);
      }
    );

    return () => {
      unsubscribeFromNetInfo();
    };
  }, []);

  const showAuthenticatedApp = useMemo(() => {
    const blockedOnSignup = currentlyOnboarding;
    const blockedOnLoginHosted =
      haveHostedLogin && (!hostedAccountInitialized || !hostedNodeRunning);
    const blockedOnLoginSelfHosted = finishingSelfHostedLogin;
    return (
      isAuthenticated &&
      !blockedOnSignup &&
      !blockedOnLoginHosted &&
      !blockedOnLoginSelfHosted
    );
  }, [
    currentlyOnboarding,
    haveHostedLogin,
    hostedAccountInitialized,
    hostedNodeRunning,
    finishingSelfHostedLogin,
    isAuthenticated,
  ]);

  const showSplashSequence = useMemo(() => {
    return showAuthenticatedApp && needsSplashSequence;
  }, [showAuthenticatedApp, needsSplashSequence]);

  useClearAppBadgeUnconditionally();

  return (
    <View height={'100%'} width={'100%'} backgroundColor="$background">
      {connected ? (
        isLoading ? (
          <View flex={1} alignItems="center" justifyContent="center">
            <LoadingSpinner />
          </View>
        ) : showSplashSequence ? (
          <SplashSequence onCompleted={clearNeedsSplashSequence} />
        ) : showAuthenticatedApp ? (
          <AuthenticatedApp />
        ) : (
          <OnboardingStack />
        )
      ) : (
        <View
          height="100%"
          padding="$l"
          justifyContent="center"
          alignItems="center"
        >
          <Text textAlign="center" fontSize="$xl" color="$primaryText">
            You are offline. Please connect to the internet and try again.
          </Text>
        </View>
      )}
      <StatusBar
        backgroundColor={isDarkMode ? 'black' : 'white'}
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />
    </View>
  );
};

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

export default function ConnectedApp() {
  const isDarkMode = useIsDarkMode();
  const navigationContainerRef = useNavigationContainerRef();

  return (
    <ErrorBoundary>
      <FeatureFlagConnectedInstrumentationProvider>
        <QueryClientProvider client={queryClient}>
          <TamaguiProvider>
            <ShipProvider>
              <NavigationContainer
                theme={isDarkMode ? DarkTheme : DefaultTheme}
                ref={navigationContainerRef}
              >
                <StoreProvider>
                  <BranchProvider>
                    <PostHogProvider
                      client={posthogAsync}
                      autocapture={{
                        captureTouches: false,
                      }}
                      options={{
                        enable:
                          process.env.NODE_ENV !== 'test' ||
                          !!process.env.POST_HOG_IN_DEV,
                      }}
                    >
                      <GestureHandlerRootView style={{ flex: 1 }}>
                        <SafeAreaProvider>
                          <ToastProvider>
                            <MigrationCheck>
                              <SignupProvider>
                                <PortalProvider>
                                  <App />
                                </PortalProvider>

                                {__DEV__ && (
                                  <DevTools
                                    navigationContainerRef={
                                      navigationContainerRef
                                    }
                                  />
                                )}
                              </SignupProvider>
                            </MigrationCheck>
                          </ToastProvider>
                        </SafeAreaProvider>
                      </GestureHandlerRootView>
                    </PostHogProvider>
                  </BranchProvider>
                </StoreProvider>
              </NavigationContainer>
            </ShipProvider>
          </TamaguiProvider>
        </QueryClientProvider>
      </FeatureFlagConnectedInstrumentationProvider>
    </ErrorBoundary>
  );
}

// This is rendered as a component because I didn't have any better ideas
// on calling these hooks conditionally.
const DevTools = ({
  navigationContainerRef,
}: {
  navigationContainerRef: NavigationContainerRefWithCurrent<any>;
}) => {
  useAsyncStorageDevTools();
  useReactQueryDevTools(queryClient);
  useReactNavigationDevTools(navigationContainerRef);
  return null;
};

function useClearAppBadgeUnconditionally() {
  useEffect(() => {
    setBadgeCountAsync(0).catch((err) => {
      console.error('Failed to set badge count', err);
    });
  }, []);
}
