import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useScreenOptions } from '@tloncorp/app/hooks/useScreenOptions';

import { AllowNotificationsScreen } from './screens/Onboarding/AllowNotificationsScreen';
import { CheckOTPScreen } from './screens/Onboarding/CheckOTPScreen';
import { CheckVerifyScreen } from './screens/Onboarding/CheckVerifyScreen';
import { EULAScreen } from './screens/Onboarding/EULAScreen';
import { GettingNodeReadyScreen } from './screens/Onboarding/GettingNodeReadyScreen';
import { InitialStateCheckScreen } from './screens/Onboarding/InitialStateCheckScreen';
import { InventoryCheckScreen } from './screens/Onboarding/InventoryCheckScreen';
import { JoinWaitListScreen } from './screens/Onboarding/JoinWaitListScreen';
import { PasteInviteLinkScreen } from './screens/Onboarding/PasteInviteLinkScreen';
import { RequestPhoneVerifyScreen } from './screens/Onboarding/RequestPhoneVerifyScreen';
import { ReserveShipScreen } from './screens/Onboarding/ReserveShipScreen';
import { ResetPasswordScreen } from './screens/Onboarding/ResetPasswordScreen';
import { SetNicknameScreen } from './screens/Onboarding/SetNicknameScreen';
import { SetNotificationsScreen } from './screens/Onboarding/SetNotificationsScreen';
import { SetTelemetryScreen } from './screens/Onboarding/SetTelemetryScreen';
import { ShipLoginScreen } from './screens/Onboarding/ShipLoginScreen';
import { SignupScreen } from './screens/Onboarding/SignupScreen';
import { TlonLoginScreen } from './screens/Onboarding/TlonLogin';
import { TlonLoginLegacy } from './screens/Onboarding/TlonLoginLegacy';
import { UnderMaintenanceScreen } from './screens/Onboarding/UnderMaintenance';
import { WelcomeScreen } from './screens/Onboarding/WelcomeScreen';
import type { OnboardingStackParamList } from './types';

export const OnboardingStackNavigator =
  createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  const screenOptions = useScreenOptions();

  const onboardingScreenOptions = {
    ...screenOptions,
    headerShown: false,
  };

  return (
    <OnboardingStackNavigator.Navigator
      initialRouteName="InitialStateCheck"
      screenOptions={onboardingScreenOptions}
    >
      <OnboardingStackNavigator.Screen
        name="InitialStateCheck"
        component={InitialStateCheckScreen}
      />
      <OnboardingStackNavigator.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ animation: 'none', gestureEnabled: false }}
      />
      <OnboardingStackNavigator.Screen name="Signup" component={SignupScreen} />
      <OnboardingStackNavigator.Screen
        name="CheckOTP"
        component={CheckOTPScreen}
      />
      <OnboardingStackNavigator.Screen name="EULA" component={EULAScreen} />
      <OnboardingStackNavigator.Screen
        name="PasteInviteLink"
        component={PasteInviteLinkScreen}
      />
      <OnboardingStackNavigator.Screen
        name="InventoryCheck"
        component={InventoryCheckScreen}
      />
      <OnboardingStackNavigator.Screen
        name="JoinWaitList"
        component={JoinWaitListScreen}
      />
      <OnboardingStackNavigator.Screen
        name="RequestPhoneVerify"
        component={RequestPhoneVerifyScreen}
      />
      <OnboardingStackNavigator.Screen
        name="CheckVerify"
        component={CheckVerifyScreen}
      />
      <OnboardingStackNavigator.Screen
        name="ReserveShip"
        component={ReserveShipScreen}
        options={{ headerShown: false }}
      />
      <OnboardingStackNavigator.Screen
        name="SetNickname"
        component={SetNicknameScreen}
      />
      <OnboardingStackNavigator.Screen
        name="SetNotifications"
        component={SetNotificationsScreen}
      />
      <OnboardingStackNavigator.Screen
        name="AllowNotifications"
        component={AllowNotificationsScreen}
      />
      <OnboardingStackNavigator.Screen
        name="SetTelemetry"
        component={SetTelemetryScreen}
      />
      <OnboardingStackNavigator.Screen
        name="TlonLogin"
        component={TlonLoginScreen}
      />
      <OnboardingStackNavigator.Screen
        name="TlonLoginLegacy"
        component={TlonLoginLegacy}
      />
      <OnboardingStackNavigator.Screen
        name="ShipLogin"
        component={ShipLoginScreen}
      />
      <OnboardingStackNavigator.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
      />
      <OnboardingStackNavigator.Screen
        name="GettingNodeReadyScreen"
        component={GettingNodeReadyScreen}
      />
      <OnboardingStackNavigator.Screen
        name="UnderMaintenance"
        component={UnderMaintenanceScreen}
      />
    </OnboardingStackNavigator.Navigator>
  );
}
