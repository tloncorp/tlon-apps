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
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { useScreenOptions } from '@tloncorp/app/hooks/useScreenOptions';
import { useMigrations } from '@tloncorp/app/lib/nativeDb';
import { Provider as TamaguiProvider } from '@tloncorp/app/provider';
import { posthogAsync } from '@tloncorp/app/utils/posthog';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import { usePreloadedEmojis } from '@tloncorp/ui';
import { PostHogProvider } from 'posthog-react-native';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { StatusBar, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTailwind } from 'tailwind-rn';

import AuthenticatedApp from './components/AuthenticatedApp';
import { LoadingSpinner } from './components/LoadingSpinner';
import { CheckVerifyScreen } from './screens/CheckVerifyScreen';
import { EULAScreen } from './screens/EULAScreen';
import { JoinWaitListScreen } from './screens/JoinWaitListScreen';
import { RequestPhoneVerifyScreen } from './screens/RequestPhoneVerifyScreen';
import { ReserveShipScreen } from './screens/ReserveShipScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { SetNicknameScreen } from './screens/SetNicknameScreen';
import { SetNotificationsScreen } from './screens/SetNotificationsScreen';
import { SetTelemetryScreen } from './screens/SetTelemetryScreen';
import { ShipLoginScreen } from './screens/ShipLoginScreen';
import { SignUpEmailScreen } from './screens/SignUpEmailScreen';
import { SignUpPasswordScreen } from './screens/SignUpPasswordScreen';
import { TlonLoginScreen } from './screens/TlonLoginScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
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
  const tailwind = useTailwind();
  const { isLoading, isAuthenticated } = useShip();
  const [connected, setConnected] = useState(true);
  const { lure, priorityToken } = useBranch();
  const screenOptions = useScreenOptions();
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
    <View style={tailwind('h-full w-full bg-white dark:bg-black')}>
      {connected ? (
        isLoading ? (
          <View style={tailwind('h-full flex items-center justify-center')}>
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
            screenOptions={screenOptions}
          >
            <OnboardingStack.Screen
              name="Welcome"
              component={WelcomeScreen}
              options={{
                headerShown: false,
              }}
            />
            <OnboardingStack.Screen
              name="SignUpEmail"
              component={SignUpEmailScreen}
              options={{ headerTitle: 'Sign Up' }}
              initialParams={{ lure, priorityToken }}
            />
            <OnboardingStack.Screen
              name="EULA"
              component={EULAScreen}
              options={{ headerTitle: 'EULA' }}
            />
            <OnboardingStack.Screen
              name="SignUpPassword"
              component={SignUpPasswordScreen}
              options={{ headerTitle: 'Set a Password' }}
            />
            <OnboardingStack.Screen
              name="JoinWaitList"
              component={JoinWaitListScreen}
              options={{ headerTitle: 'Join Waitlist' }}
            />
            <OnboardingStack.Screen
              name="RequestPhoneVerify"
              component={RequestPhoneVerifyScreen}
              options={{ headerTitle: 'Sign Up' }}
            />
            <OnboardingStack.Screen
              name="CheckVerify"
              component={CheckVerifyScreen}
              options={{ headerTitle: 'Confirmation' }}
            />
            <OnboardingStack.Screen
              name="ReserveShip"
              component={ReserveShipScreen}
              options={{ headerShown: false }}
            />
            <OnboardingStack.Screen
              name="SetNickname"
              component={SetNicknameScreen}
              options={{
                headerTitle: 'Display Name',
                headerBackVisible: false,
              }}
            />
            <OnboardingStack.Screen
              name="SetNotifications"
              component={SetNotificationsScreen}
              options={{ headerTitle: 'Notifications' }}
            />
            <OnboardingStack.Screen
              name="SetTelemetry"
              component={SetTelemetryScreen}
              options={{ headerTitle: 'Telemetry' }}
            />
            <OnboardingStack.Screen
              name="TlonLogin"
              component={TlonLoginScreen}
              options={{ headerTitle: 'Log In' }}
            />
            <OnboardingStack.Screen
              name="ShipLogin"
              component={ShipLoginScreen}
              options={{ headerTitle: 'Connect Ship' }}
            />
            <OnboardingStack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{ headerTitle: 'Reset Password' }}
            />
          </OnboardingStack.Navigator>
        )
      ) : (
        <View style={tailwind('h-full p-4 flex items-center justify-center')}>
          <Text
            style={tailwind(
              'text-center text-xl font-semibold text-tlon-black-80 dark:text-white'
            )}
          >
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
  const tailwind = useTailwind();
  const navigationContainerRef = useNavigationContainerRef();

  return (
    <ErrorBoundary>
      <TamaguiProvider defaultTheme={isDarkMode ? 'dark' : 'light'}>
        <ShipProvider>
          <NavigationContainer
            theme={isDarkMode ? DarkTheme : DefaultTheme}
            ref={navigationContainerRef}
          >
            <BranchProvider>
              <PostHogProvider client={posthogAsync} autocapture>
                <GestureHandlerRootView style={tailwind('flex-1')}>
                  <SafeAreaProvider>
                    <MigrationCheck>
                      <QueryClientProvider client={queryClient}>
                        <App {...props} />

                        {__DEV__ && (
                          <DevTools
                            navigationContainerRef={navigationContainerRef}
                          />
                        )}
                      </QueryClientProvider>
                    </MigrationCheck>
                  </SafeAreaProvider>
                </GestureHandlerRootView>
              </PostHogProvider>
            </BranchProvider>
          </NavigationContainer>
        </ShipProvider>
      </TamaguiProvider>
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
