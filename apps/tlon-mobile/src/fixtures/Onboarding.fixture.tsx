import { NavigationContainer } from '@react-navigation/native';
import { Context as BranchContext } from '@tloncorp/app/contexts/branch';
import { exampleContacts } from '@tloncorp/app/fixtures/contentHelpers';
import { group } from '@tloncorp/app/fixtures/fakeData';
import { Theme } from '@tloncorp/app/ui';
import { AppInvite, QueryClientProvider, queryClient } from '@tloncorp/shared';
import { PropsWithChildren, useState } from 'react';
import { useFixtureSelect } from 'react-cosmos/client';

import { OnboardingStack, OnboardingStackNavigator } from '../OnboardingStack';
import { OnboardingProvider } from '../lib/OnboardingContext';
import { AllowNotificationsScreen } from '../screens/Onboarding/AllowNotificationsScreen';
import { CheckOTPScreen } from '../screens/Onboarding/CheckOTPScreen';
import { CheckVerifyScreen } from '../screens/Onboarding/CheckVerifyScreen';
import { EULAScreen } from '../screens/Onboarding/EULAScreen';
import { GettingNodeReadyScreen } from '../screens/Onboarding/GettingNodeReadyScreen';
import { InventoryCheckScreen } from '../screens/Onboarding/InventoryCheckScreen';
import { JoinWaitListScreen } from '../screens/Onboarding/JoinWaitListScreen';
import { PasteInviteLinkScreen } from '../screens/Onboarding/PasteInviteLinkScreen';
import { RequestPhoneVerifyScreen } from '../screens/Onboarding/RequestPhoneVerifyScreen';
import { ReserveShipScreen } from '../screens/Onboarding/ReserveShipScreen';
import { SetNicknameScreen } from '../screens/Onboarding/SetNicknameScreen';
import { SetNotificationsScreen } from '../screens/Onboarding/SetNotificationsScreen';
import { SetTelemetryScreen } from '../screens/Onboarding/SetTelemetryScreen';
import { ShipLoginScreen } from '../screens/Onboarding/ShipLoginScreen';
import { SignupScreen } from '../screens/Onboarding/SignupScreen';
import { TlonLoginScreen } from '../screens/Onboarding/TlonLogin';
import { TlonLoginLegacy } from '../screens/Onboarding/TlonLoginLegacy';
import { WelcomeScreen } from '../screens/Onboarding/WelcomeScreen';
import { OnboardingStackParamList, User } from '../types';

const sampleUser = {
  id: '1',
  nickname: 'test',
  email: 'dan@tlon.io',
  ships: [],
  admin: false,
  verified: false,
  requirePhoneNumberVerification: false,
};

function OnboardingFixture({
  hasGroupInvite,
  children,
}: PropsWithChildren<{ hasGroupInvite: boolean }>) {
  const [lure, setLure] = useState<AppInvite | undefined>(
    hasGroupInvite
      ? {
          id: group.id,
          shouldAutoJoin: true,
          inviterUserId: exampleContacts.ed.id,
          inviterNickname: exampleContacts.ed.nickname,
          invitedGroupId: group.id,
          invitedGroupTitle: group.title ?? undefined,
          invitedGroupDescription: group.description ?? undefined,
          invitedGroupIconImageUrl: group.iconImage ?? undefined,
          invitedGroupiconImageColor: group.iconImageColor ?? undefined,
        }
      : undefined
  );

  const [theme] = useFixtureSelect('themeName', {
    options: ['light', 'dark'],
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Theme name={theme ? theme : 'light'}>
        <OnboardingProvider
          value={{
            initRecaptcha: () => Promise.resolve('abc'),
            execRecaptchaLogin: () => Promise.resolve('abc'),
            getLandscapeAuthCookie: () => Promise.resolve('abc'),
            //@ts-expect-error partial implementation
            hostingApi: {
              signUpHostingUser: async () => Promise.resolve(sampleUser),
              logInHostingUser: () => Promise.resolve(sampleUser),
              getHostingAvailability: async () =>
                Promise.resolve({ enabled: true, validEmail: true }),
              getHostingUser: async () => Promise.resolve(sampleUser as User),
              getReservableShips: async () =>
                Promise.resolve([
                  { id: '~solfer-magfed', readyForDistribution: true },
                ]),
              getShipAccessCode: async () => Promise.resolve({ code: 'xyz' }),
              allocateReservedShip: async () => Promise.resolve({}),
              reserveShip: async () =>
                Promise.resolve({
                  id: '~solfer-magfed',
                  reservedBy: '1',
                }),
              checkPhoneVerify: async () => Promise.resolve({ verified: true }),
              verifyEmailDigits: async () =>
                Promise.resolve({ verified: true }),
              requestPhoneVerify: async () => Promise.resolve({}),
            },
          }}
        >
          <BranchContext.Provider
            value={{
              lure,
              setLure: setLure as unknown as (lure: AppInvite) => void,
              clearLure: () => setLure(undefined),
              clearDeepLink: () => {},
              deepLinkPath: undefined,
              priorityToken: undefined,
            }}
          >
            <NavigationContainer>
              {children ?? <OnboardingStack />}
            </NavigationContainer>
          </BranchContext.Provider>
        </OnboardingProvider>
      </Theme>
    </QueryClientProvider>
  );
}

function SingleScreenFixture<T extends keyof OnboardingStackParamList>({
  routeName,
  params,
  Component,
}: {
  routeName: T;
  params?: OnboardingStackParamList[T];
  Component: React.ComponentType<any>;
}) {
  return (
    <OnboardingFixture hasGroupInvite={true}>
      <OnboardingStackNavigator.Navigator
        screenOptions={{ headerShown: false }}
      >
        <OnboardingStackNavigator.Screen
          name={routeName}
          initialParams={params}
          component={Component}
        />
      </OnboardingStackNavigator.Navigator>
    </OnboardingFixture>
  );
}

export default {
  Stack: (
    <OnboardingFixture hasGroupInvite={false}>
      <OnboardingStack />
    </OnboardingFixture>
  ),
  StackWithGroupInvite: (
    <OnboardingFixture hasGroupInvite={true}>
      <OnboardingStack />
    </OnboardingFixture>
  ),
  Nickname: (
    <SingleScreenFixture
      routeName="SetNickname"
      Component={SetNicknameScreen}
    />
  ),
  JoinWaitlist: (
    <SingleScreenFixture
      routeName="JoinWaitList"
      params={{ email: '' }}
      Component={JoinWaitListScreen}
    />
  ),
  RequestPhoneVerify: (
    <SingleScreenFixture
      routeName="RequestPhoneVerify"
      Component={RequestPhoneVerifyScreen}
    />
  ),
  CheckVerify: (
    <SingleScreenFixture
      routeName="CheckVerify"
      Component={CheckVerifyScreen}
    />
  ),
  ReserveShip: (
    <SingleScreenFixture
      routeName="ReserveShip"
      Component={ReserveShipScreen}
    />
  ),
  SetNickname: (
    <SingleScreenFixture
      routeName="SetNickname"
      Component={SetNicknameScreen}
    />
  ),
  SetTelemetry: (
    <SingleScreenFixture
      routeName="SetTelemetry"
      Component={SetTelemetryScreen}
    />
  ),
  SetNotifications: (
    <SingleScreenFixture
      routeName="SetNotifications"
      Component={SetNotificationsScreen}
    />
  ),
  AllowNotifications: (
    <SingleScreenFixture
      routeName="AllowNotifications"
      Component={AllowNotificationsScreen}
    />
  ),
  Welcome: (
    <SingleScreenFixture routeName={'Welcome'} Component={WelcomeScreen} />
  ),
  InventoryCheck: (
    <SingleScreenFixture
      routeName={'InventoryCheck'}
      Component={InventoryCheckScreen}
    />
  ),
  SignUpPhoneNumber: (
    <SingleScreenFixture routeName="Signup" Component={SignupScreen} />
  ),
  CheckOtpPhoneSignup: (
    <SingleScreenFixture
      routeName={'CheckOTP'}
      Component={CheckOTPScreen}
      params={{ otpMethod: 'phone', mode: 'signup' }}
    />
  ),
  EULA: <SingleScreenFixture routeName={'EULA'} Component={EULAScreen} />,
  PasteInviteLink: (
    <SingleScreenFixture
      routeName={'PasteInviteLink'}
      Component={PasteInviteLinkScreen}
    />
  ),
  TlonLoginScreen: (
    <SingleScreenFixture routeName={'TlonLogin'} Component={TlonLoginScreen} />
  ),
  TlonLogin: (
    <SingleScreenFixture
      routeName={'TlonLoginLegacy'}
      Component={TlonLoginLegacy}
    />
  ),
  ShipLogin: (
    <SingleScreenFixture routeName={'ShipLogin'} Component={ShipLoginScreen} />
  ),
  GettingNodeReady: (
    <SingleScreenFixture
      routeName={'GettingNodeReadyScreen'}
      Component={GettingNodeReadyScreen}
      params={{ waitType: 'Paused', wasLoggedIn: true }}
    />
  ),
};
