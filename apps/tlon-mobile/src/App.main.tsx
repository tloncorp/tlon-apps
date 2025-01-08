import { useAsyncStorageDevTools } from '@dev-plugins/async-storage';
import { useReactNavigationDevTools } from '@dev-plugins/react-navigation';
import { useReactQueryDevTools } from '@dev-plugins/react-query';
import NetInfo from '@react-native-community/netinfo';
import crashlytics from '@react-native-firebase/crashlytics';
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
import { useMigrations } from '@tloncorp/app/lib/nativeDb';
import { PlatformState } from '@tloncorp/app/lib/platformHelpers';
import { Provider as TamaguiProvider } from '@tloncorp/app/provider';
import { FeatureFlagConnectedInstrumentationProvider } from '@tloncorp/app/utils/perf';
import { posthogAsync } from '@tloncorp/app/utils/posthog';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/api';
import { finishingSelfHostedLogin as selfHostedLoginStatus } from '@tloncorp/shared/db';
import {
  LoadingSpinner,
  PortalProvider,
  StoreProvider,
  Text,
  View,
  usePreloadedEmojis,
} from '@tloncorp/ui';
import { PostHogProvider } from 'posthog-react-native';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OnboardingStack } from './OnboardingStack';
import AuthenticatedApp from './components/AuthenticatedApp';
import { SignupProvider, useSignupContext } from './lib/signupContext';

// Android notification tap handler passes initial params here
const App = () => {
  const isDarkMode = useIsDarkMode();
  const { isLoading, isAuthenticated } = useShip();
  const [connected, setConnected] = useState(true);
  const signupContext = useSignupContext();
  const finishingSelfHostedLogin = selfHostedLoginStatus.useValue();

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
    return (
      isAuthenticated && !(currentlyOnboarding || finishingSelfHostedLogin)
    );
  }, [isAuthenticated, currentlyOnboarding, finishingSelfHostedLogin]);

  return (
    <View height={'100%'} width={'100%'} backgroundColor="$background">
      {connected ? (
        isLoading ? (
          <View flex={1} alignItems="center" justifyContent="center">
            <LoadingSpinner />
          </View>
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
                        <MigrationCheck>
                          <QueryClientProvider client={queryClient}>
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
                          </QueryClientProvider>
                        </MigrationCheck>
                      </SafeAreaProvider>
                    </GestureHandlerRootView>
                  </PostHogProvider>
                </BranchProvider>
              </StoreProvider>
            </NavigationContainer>
          </ShipProvider>
        </TamaguiProvider>
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
