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
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ErrorBoundary from '@tloncorp/app/ErrorBoundary';
import { BranchProvider, useBranch } from '@tloncorp/app/contexts/branch';
import { ShipProvider, useShip } from '@tloncorp/app/contexts/ship';
import { SignupProvider } from '@tloncorp/app/contexts/signup';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { useScreenOptions } from '@tloncorp/app/hooks/useScreenOptions';
import { useMigrations } from '@tloncorp/app/lib/nativeDb';
import { Provider as TamaguiProvider } from '@tloncorp/app/provider';
import { FeatureFlagConnectedInstrumentationProvider } from '@tloncorp/app/utils/perf';
import { posthogAsync } from '@tloncorp/app/utils/posthog';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import { LoadingSpinner, PortalProvider, Text, View } from '@tloncorp/ui';
import { usePreloadedEmojis } from '@tloncorp/ui';
import { PostHogProvider } from 'posthog-react-native';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthenticatedApp from './components/AuthenticatedApp';
import { CheckVerifyScreen } from './screens/Onboarding/CheckVerifyScreen';
import { EULAScreen } from './screens/Onboarding/EULAScreen';
import { InventoryCheckScreen } from './screens/Onboarding/InventoryCheckScreen';
import { JoinWaitListScreen } from './screens/Onboarding/JoinWaitListScreen';
import { RequestPhoneVerifyScreen } from './screens/Onboarding/RequestPhoneVerifyScreen';
import { ReserveShipScreen } from './screens/Onboarding/ReserveShipScreen';
import { ResetPasswordScreen } from './screens/Onboarding/ResetPasswordScreen';
import { SetNicknameScreen } from './screens/Onboarding/SetNicknameScreen';
import { SetTelemetryScreen } from './screens/Onboarding/SetTelemetryScreen';
import { ShipLoginScreen } from './screens/Onboarding/ShipLoginScreen';
import { SignUpEmailScreen } from './screens/Onboarding/SignUpEmailScreen';
import { SignUpPasswordScreen } from './screens/Onboarding/SignUpPasswordScreen';
import { TlonLoginScreen } from './screens/Onboarding/TlonLoginScreen';
import { WelcomeScreen } from './screens/Onboarding/WelcomeScreen';
import type { OnboardingStackParamList } from './types';

type Props = {
  wer?: string;
  channelId?: string;
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

// Android notification tap handler passes initial params here
const App = ({
  wer: notificationPath,
  channelId: notificationChannelId,
}: Props) => {
  const isDarkMode = useIsDarkMode();

  const { isLoading, isAuthenticated } = useShip();
  const [connected, setConnected] = useState(true);
  const { lure, priorityToken } = useBranch();
  const screenOptions = useScreenOptions();

  const onboardingScreenOptions = {
    ...screenOptions,
    headerShown: false,
  };

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

  return (
    <View height={'100%'} width={'100%'} backgroundColor="$background">
      {connected ? (
        isLoading ? (
          <View flex={1} alignItems="center" justifyContent="center">
            <LoadingSpinner />
          </View>
        ) : isAuthenticated ? (
          <AuthenticatedApp
            notificationListenerProps={{
              notificationPath,
              notificationChannelId,
            }}
          />
        ) : (
          <OnboardingStack.Navigator
            initialRouteName="Welcome"
            screenOptions={onboardingScreenOptions}
          >
            <OnboardingStack.Screen name="Welcome" component={WelcomeScreen} />
            <OnboardingStack.Screen
              name="SignUpEmail"
              component={SignUpEmailScreen}
            />
            <OnboardingStack.Screen name="EULA" component={EULAScreen} />
            <OnboardingStack.Screen
              name="InventoryCheck"
              component={InventoryCheckScreen}
            />
            <OnboardingStack.Screen
              name="SignUpPassword"
              component={SignUpPasswordScreen}
            />
            <OnboardingStack.Screen
              name="JoinWaitList"
              component={JoinWaitListScreen}
            />
            <OnboardingStack.Screen
              name="RequestPhoneVerify"
              component={RequestPhoneVerifyScreen}
            />
            <OnboardingStack.Screen
              name="CheckVerify"
              component={CheckVerifyScreen}
            />
            <OnboardingStack.Screen
              name="ReserveShip"
              component={ReserveShipScreen}
              options={{ headerShown: false }}
            />
            <OnboardingStack.Screen
              name="SetNickname"
              component={SetNicknameScreen}
            />
            <OnboardingStack.Screen
              name="SetTelemetry"
              component={SetTelemetryScreen}
            />
            <OnboardingStack.Screen
              name="TlonLogin"
              component={TlonLoginScreen}
            />
            <OnboardingStack.Screen
              name="ShipLogin"
              component={ShipLoginScreen}
            />
            <OnboardingStack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
          </OnboardingStack.Navigator>
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

export default function ConnectedApp(props: Props) {
  const isDarkMode = useIsDarkMode();
  const navigationContainerRef = useNavigationContainerRef();

  return (
    <ErrorBoundary>
      <FeatureFlagConnectedInstrumentationProvider>
        <TamaguiProvider defaultTheme={isDarkMode ? 'dark' : 'light'}>
          <ShipProvider>
            <NavigationContainer
              theme={isDarkMode ? DarkTheme : DefaultTheme}
              ref={navigationContainerRef}
            >
              <BranchProvider>
                <PostHogProvider
                  client={posthogAsync}
                  autocapture
                  options={{
                    enable: process.env.NODE_ENV !== 'test',
                  }}
                >
                  <SignupProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <SafeAreaProvider>
                        <MigrationCheck>
                          <QueryClientProvider client={queryClient}>
                            <PortalProvider>
                              <App {...props} />
                            </PortalProvider>

                            {__DEV__ && (
                              <DevTools
                                navigationContainerRef={navigationContainerRef}
                              />
                            )}
                          </QueryClientProvider>
                        </MigrationCheck>
                      </SafeAreaProvider>
                    </GestureHandlerRootView>
                  </SignupProvider>
                </PostHogProvider>
              </BranchProvider>
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
