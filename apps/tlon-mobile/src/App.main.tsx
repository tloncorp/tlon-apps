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
import { useQueryClient } from '@tanstack/react-query';
import ErrorBoundary from '@tloncorp/app/ErrorBoundary';
import { BranchProvider } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { registerBackgroundSyncTask } from '@tloncorp/app/lib/backgroundSync';
import { useMigrations } from '@tloncorp/app/lib/nativeDb';
import { splashScreenProgress } from '@tloncorp/app/lib/splashscreen';
import { BaseProviderStack } from '@tloncorp/app/provider/BaseProviderStack';
import {
  LoadingSpinner,
  SplashSequence,
  Text,
  View,
  usePreloadedEmojis,
} from '@tloncorp/app/ui';
import { FeatureFlagConnectedInstrumentationProvider } from '@tloncorp/app/utils/perf';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { withRetry } from '@tloncorp/shared/logic';
import { setBadgeCountAsync } from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useState } from 'react';
import { NativeModules, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OnboardingStack } from './OnboardingStack';
import AuthenticatedApp from './components/AuthenticatedApp';
import { SignupProvider, useSignupContext } from './lib/signupContext';

const splashscreenLogger = createDevLogger('splashscreen', false);
SplashScreen.preventAutoHideAsync().catch((err) => {
  console.warn('Failed to prevent auto hide splash screen', err);
});

splashScreenProgress.emitter.on('complete', async () => {
  try {
    await withRetry(() => SplashScreen.hideAsync());
  } catch (error) {
    splashscreenLogger.trackError('Failed to hide splash screen', { error });
  }
});

registerBackgroundSyncTask();

// Used for debugging our background task identifier from Info.plist
const UrbitModule = NativeModules.UrbitModule;
if (UrbitModule) {
  UrbitModule.getDebugInfo()
    .then((identifiers: string[]) => {
      if (identifiers.length) {
        db.debugPermittedSchedulerId.setValue(identifiers[0]);
        splashscreenLogger.trackEvent(
          `set debug Permitted Scheduler ID to ${identifiers[0]}`
        );
      } else {
        throw new Error('No permitted scheduler identifiers found');
      }
    })
    .catch((error: any) => {
      splashscreenLogger.trackError(
        'Failed to find permitted scheduler identifiers',
        {
          errorMessage:
            error instanceof Error ? error.message : error.toString(),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
    });
}

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

export default function ConnectedApp() {
  const isDarkMode = useIsDarkMode();
  const navigationContainerRef = useNavigationContainerRef();
  const migrationState = useMigrations();

  return (
    <FeatureFlagConnectedInstrumentationProvider>
      <NavigationContainer
        theme={isDarkMode ? DarkTheme : DefaultTheme}
        ref={navigationContainerRef}
      >
        <BaseProviderStack migrationState={migrationState}>
          <ErrorBoundary>
            <BranchProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <SignupProvider>
                  <App />

                  {__DEV__ && (
                    <DevTools navigationContainerRef={navigationContainerRef} />
                  )}
                </SignupProvider>
              </GestureHandlerRootView>
            </BranchProvider>
          </ErrorBoundary>
        </BaseProviderStack>
      </NavigationContainer>
    </FeatureFlagConnectedInstrumentationProvider>
  );
}

// This is rendered as a component because I didn't have any better ideas
// on calling these hooks conditionally.
const DevTools = ({
  navigationContainerRef,
}: {
  navigationContainerRef: NavigationContainerRefWithCurrent<any>;
}) => {
  const queryClient = useQueryClient();
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
