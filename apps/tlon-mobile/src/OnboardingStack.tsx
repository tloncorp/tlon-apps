import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useScreenOptions } from '@tloncorp/app/hooks/useScreenOptions';

import { CheckVerifyScreen } from './screens/Onboarding/CheckVerifyScreen';
import { EULAScreen } from './screens/Onboarding/EULAScreen';
import { InventoryCheckScreen } from './screens/Onboarding/InventoryCheckScreen';
import { JoinWaitListScreen } from './screens/Onboarding/JoinWaitListScreen';
import { PasteInviteLinkScreen } from './screens/Onboarding/PasteInviteLinkScreen';
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
      initialRouteName="Welcome"
      screenOptions={onboardingScreenOptions}
    >
      <OnboardingStackNavigator.Screen
        name="Welcome"
        component={WelcomeScreen}
      />
      <OnboardingStackNavigator.Screen
        name="SignUpEmail"
        component={SignUpEmailScreen}
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
        name="SignUpPassword"
        component={SignUpPasswordScreen}
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
        name="SetTelemetry"
        component={SetTelemetryScreen}
      />
      <OnboardingStackNavigator.Screen
        name="TlonLogin"
        component={TlonLoginScreen}
      />
      <OnboardingStackNavigator.Screen
        name="ShipLogin"
        component={ShipLoginScreen}
      />
      <OnboardingStackNavigator.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
      />
    </OnboardingStackNavigator.Navigator>
  );
}
