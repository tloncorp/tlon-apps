import { NavigationContainer } from '@react-navigation/native';
import {
  Context as BranchContext,
  LureData,
} from '@tloncorp/app/contexts/branch';
import {
  DeepLinkData,
  QueryClientProvider,
  queryClient,
} from '@tloncorp/shared/dist';
import { PropsWithChildren, useState } from 'react';

import { OnboardingStack, OnboardingStackNavigator } from '../OnboardingStack';
import { OnboardingProvider } from '../lib/OnboardingContext';
import { CheckVerifyScreen } from '../screens/Onboarding/CheckVerifyScreen';
import { EULAScreen } from '../screens/Onboarding/EULAScreen';
import { InventoryCheckScreen } from '../screens/Onboarding/InventoryCheckScreen';
import { JoinWaitListScreen } from '../screens/Onboarding/JoinWaitListScreen';
import { PasteInviteLinkScreen } from '../screens/Onboarding/PasteInviteLinkScreen';
import { RequestPhoneVerifyScreen } from '../screens/Onboarding/RequestPhoneVerifyScreen';
import { ReserveShipScreen } from '../screens/Onboarding/ReserveShipScreen';
import { SetNicknameScreen } from '../screens/Onboarding/SetNicknameScreen';
import { SetTelemetryScreen } from '../screens/Onboarding/SetTelemetryScreen';
import { ShipLoginScreen } from '../screens/Onboarding/ShipLoginScreen';
import { SignUpEmailScreen } from '../screens/Onboarding/SignUpEmailScreen';
import { SignUpPasswordScreen } from '../screens/Onboarding/SignUpPasswordScreen';
import { TlonLoginScreen } from '../screens/Onboarding/TlonLoginScreen';
import { WelcomeScreen } from '../screens/Onboarding/WelcomeScreen';
import { OnboardingStackParamList, User } from '../types';
import { exampleContacts } from './contentHelpers';
import { group } from './fakeData';

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
  const [lure, setLure] = useState<LureData | undefined>(
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
  return (
    <QueryClientProvider client={queryClient}>
      <OnboardingProvider
        value={{
          initRecaptcha: () => Promise.resolve('abc'),
          execRecaptchaLogin: () => Promise.resolve('abc'),
          getLandscapeAuthCookie: () => Promise.resolve('abc'),
          //@ts-expect-error partial implementation
          hostingApi: {
            signUpHostingUser: async () => Promise.resolve({}),
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
            getShipsWithStatus: async () =>
              Promise.resolve({
                shipId: '~solfer-magfed',
                status: 'Ready',
              }),
            reserveShip: async () =>
              Promise.resolve({
                id: '~solfer-magfed',
                reservedBy: '1',
              }),
            checkPhoneVerify: async () => Promise.resolve({ verified: true }),
            verifyEmailDigits: async () => Promise.resolve({ verified: true }),
            requestPhoneVerify: async () => Promise.resolve({}),
          },
        }}
      >
        <BranchContext.Provider
          value={{
            lure,
            setLure: setLure as unknown as (data: DeepLinkData) => void,
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
      params={{ user: sampleUser }}
      Component={SetNicknameScreen}
    />
  ),
  Password: (
    <SingleScreenFixture
      routeName="SignUpPassword"
      params={{ email: '' }}
      Component={SignUpPasswordScreen}
    />
  ),
  JoinWaitlist: (
    <SingleScreenFixture
      routeName="SignUpPassword"
      params={{ email: '' }}
      Component={JoinWaitListScreen}
    />
  ),
  RequestPhoneVerify: (
    <SingleScreenFixture
      routeName="RequestPhoneVerify"
      Component={RequestPhoneVerifyScreen}
      params={{ user: sampleUser }}
    />
  ),
  CheckVerify: (
    <SingleScreenFixture
      routeName="CheckVerify"
      Component={CheckVerifyScreen}
      params={{ user: sampleUser }}
    />
  ),
  ReserveShip: (
    <SingleScreenFixture
      routeName="ReserveShip"
      Component={ReserveShipScreen}
      params={{ user: sampleUser }}
    />
  ),
  SetNickname: (
    <SingleScreenFixture
      routeName="SetNickname"
      Component={SetNicknameScreen}
      params={{ user: sampleUser }}
    />
  ),
  SetTelemetry: (
    <SingleScreenFixture
      routeName="SetTelemetry"
      Component={SetTelemetryScreen}
      params={{ user: sampleUser }}
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
  SignUpEmail: (
    <SingleScreenFixture
      routeName={'SignUpEmail'}
      Component={SignUpEmailScreen}
    />
  ),
  EULA: <SingleScreenFixture routeName={'EULA'} Component={EULAScreen} />,
  PasteInviteLink: (
    <SingleScreenFixture
      routeName={'PasteInviteLink'}
      Component={PasteInviteLinkScreen}
    />
  ),
  TlonLogin: (
    <SingleScreenFixture routeName={'TlonLogin'} Component={TlonLoginScreen} />
  ),
  ShipLogin: (
    <SingleScreenFixture routeName={'ShipLogin'} Component={ShipLoginScreen} />
  ),
};
