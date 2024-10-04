import { NavigationContainer } from '@react-navigation/native';
import {
  Context as BranchContext,
  LureData,
} from '@tloncorp/app/contexts/branch';
import { DeepLinkData } from 'packages/shared/dist';
import { PropsWithChildren, useState } from 'react';

import { OnboardingStack } from '../OnboardingStack';
import { OnboardingProvider } from '../lib/OnboardingContext';
import { SetNicknameScreen } from '../screens/Onboarding/SetNicknameScreen';
import { User } from '../types';
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
    <OnboardingFixture hasGroupInvite={false}>
      <SetNicknameScreen
        // @ts-expect-error partial implementation
        navigation={{ addListener: () => {} }}
        // @ts-expect-error partial implementation
        route={{ params: {} }}
      />
    </OnboardingFixture>
  ),
};
