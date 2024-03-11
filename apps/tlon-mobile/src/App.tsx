import NetInfo from '@react-native-community/netinfo';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TamaguiProvider } from '@tloncorp/ui';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect, useState } from 'react';
import { StatusBar, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTailwind } from 'tailwind-rn';

import AuthenticatedApp from './components/AuthenticatedApp';
import { LoadingSpinner } from './components/LoadingSpinner';
import { DEV_LOCAL, DEV_LOCAL_CODE } from './constants';
import { BranchProvider, useBranch } from './contexts/branch';
import { ShipProvider, useShip } from './contexts/ship';
import * as db from './db';
import { useIsDarkMode } from './hooks/useIsDarkMode';
import { useScreenOptions } from './hooks/useScreenOptions';
import { useDevTools } from './lib/useDevTools';
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
import { posthogAsync } from './utils/posthog';
import { getPathFromWer } from './utils/string';

type Props = {
  wer?: string;
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

const App = ({ wer: initialWer }: Props) => {
  useDevTools({ enabled: DEV_LOCAL, localCode: DEV_LOCAL_CODE });
  const isDarkMode = useIsDarkMode();
  const tailwind = useTailwind();
  const { isLoading, isAuthenticated } = useShip();
  const [connected, setConnected] = useState(true);
  const { lure, priorityToken } = useBranch();
  const screenOptions = useScreenOptions();

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
    <GestureHandlerRootView style={tailwind('flex-1')}>
      <SafeAreaProvider>
        <View style={tailwind('h-full w-full bg-white dark:bg-black')}>
          {connected ? (
            isLoading ? (
              <View style={tailwind('h-full flex items-center justify-center')}>
                <LoadingSpinner />
              </View>
            ) : isAuthenticated ? (
              <AuthenticatedApp
                initialNotificationPath={getPathFromWer(initialWer ?? '')}
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
            <View
              style={tailwind('h-full p-4 flex items-center justify-center')}
            >
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default function ConnectedApp(props: Props) {
  const isDarkMode = useIsDarkMode();
  return (
    <db.RealmProvider>
      <TamaguiProvider defaultTheme={isDarkMode ? 'dark' : 'light'}>
        <ShipProvider>
          <NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
            <BranchProvider>
              <PostHogProvider client={posthogAsync} autocapture>
                <App {...props} />
              </PostHogProvider>
            </BranchProvider>
          </NavigationContainer>
        </ShipProvider>
      </TamaguiProvider>
    </db.RealmProvider>
  );
}
