import NetInfo from '@react-native-community/netinfo';
import {
  CommonActions,
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigation,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TamaguiProvider } from '@tloncorp/ui';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect, useState } from 'react';
import { Alert, StatusBar, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTailwind } from 'tailwind-rn';

import { LoadingSpinner } from './components/LoadingSpinner';
import { DEV_LOCAL, DEV_SHIP_CODE } from './constants';
import { ShipProvider, useShip } from './contexts/ship';
import { useDeepLink } from './hooks/useDeepLink';
import { useIsDarkMode } from './hooks/useIsDarkMode';
import { useScreenOptions } from './hooks/useScreenOptions';
import { inviteShipWithLure } from './lib/hostingApi';
import { getDevCookie } from './lib/landscapeApi';
import { TabStack } from './navigation/TabStack';
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
import { posthogAsync, trackError } from './utils/posthog';

type Props = {
  wer?: string;
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

const App = ({ wer: initialWer }: Props) => {
  const isDarkMode = useIsDarkMode();
  const tailwind = useTailwind();
  const { isLoading, isAuthenticated, ship, setShip, clearShip } = useShip();
  const [connected, setConnected] = useState(true);
  const { wer, lure, priorityToken, clearDeepLink } = useDeepLink();
  const navigation = useNavigation();
  const screenOptions = useScreenOptions();
  const gotoPath = wer ?? initialWer;

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

  useEffect(() => {
    // User received a lure link while authenticated
    if (ship && lure) {
      (async () => {
        try {
          await inviteShipWithLure({ ship, lure });
          Alert.alert(
            '',
            'Your invitation to the group is on its way. It will appear in the Groups list.',
            [
              {
                text: 'OK',
                onPress: () => null,
              },
            ],
            { cancelable: true }
          );
        } catch (err) {
          console.error('Error inviting ship with lure:', err);
          if (err instanceof Error) {
            trackError(err);
          }
        }

        clearDeepLink();
      })();
    }
  }, [ship, lure, clearDeepLink]);

  useEffect(() => {
    const DEV_SHIP_URL = 'http://localhost';
    async function setupDevAuth() {
      const auth = await getDevCookie(DEV_SHIP_URL, DEV_SHIP_CODE);
      if (auth) {
        console.log(`got auth: ${auth.cookie}`);
        setShip({
          ship: auth.ship,
          shipUrl: DEV_SHIP_URL,
        });
        console.log(`Development auth configured for ${auth.ship}`);
      } else {
        console.warn('Failed to set up development auth');
        clearShip();
      }
    }

    if (DEV_LOCAL) {
      console.log(`dev local set, code: ${DEV_SHIP_CODE}`);
      setupDevAuth();
    }
  }, []);

  useEffect(() => {
    // Broadcast path update to webview when changed
    if (isAuthenticated && gotoPath) {
      navigation.dispatch(CommonActions.setParams({ gotoPath }));

      // Clear the deep link to mark it as handled
      clearDeepLink();
    }
  }, [isAuthenticated, gotoPath, navigation, clearDeepLink]);

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
              <TabStack />
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

export default function AnalyticsApp(props: Props) {
  const isDarkMode = useIsDarkMode();
  return (
    <TamaguiProvider>
      <ShipProvider>
        <NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
          <PostHogProvider client={posthogAsync} autocapture>
            <App {...props} />
          </PostHogProvider>
        </NavigationContainer>
      </ShipProvider>
    </TamaguiProvider>
  );
}
