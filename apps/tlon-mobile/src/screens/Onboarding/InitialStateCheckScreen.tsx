import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LoadingSpinner, View } from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useEffect } from 'react';

import { useOnboardingHelpers } from '../../hooks/useOnboardingHelpers';
import { useReviveSavedOnboarding } from '../../hooks/useReviveSavedOnboarding';
import { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'InitialStateCheck'
>;

const logger = createDevLogger('InitialStateCheckScreen', true);

export function InitialStateCheckScreen({ navigation }: Props) {
  const reviveSignupSession = useReviveSavedOnboarding();
  const { reviveLoggedInSession } = useOnboardingHelpers();

  useEffect(() => {
    async function checkInitialState() {
      try {
        const signupData = await db.signupData.getValue();
        const nodeStoppedWhileLoggedIn =
          await db.nodeStoppedWhileLoggedIn.getValue();
        const hostingUserId = await db.hostingUserId.getValue();
        const hasPotentialSignupSession =
          signupData.email || signupData.phoneNumber;
        const hasPotentialLoggedInSession = !!hostingUserId;

        if (nodeStoppedWhileLoggedIn) {
          logger.log('node stopped while logged in');
          logger.trackEvent('Running Stopped Node Recovery');
          navigation.reset({
            index: 1,
            routes: [
              {
                name: 'GettingNodeReadyScreen',
                params: { waitType: 'Unknown', wasLoggedIn: true },
              },
            ],
          });
          return;
        }

        if (hasPotentialSignupSession) {
          const didNavigate = await reviveSignupSession();
          if (didNavigate) {
            return;
          }
        } else if (hasPotentialLoggedInSession) {
          const didNavigate = await reviveLoggedInSession();
          if (didNavigate) {
            return;
          }
        }
      } catch (e) {
        db.clearSessionStorageItems();
        logger.trackEvent('Error reviving onboarding session', {
          error: e,
        });
      }

      // avoid ever getting stuck on this screen
      setTimeout(() => {
        navigation.reset({
          index: 1,
          routes: [{ name: 'Welcome' }],
        });
      }, 700);
    }

    console.log('checking initial onboarding state');
    checkInitialState();
  }, []);

  return (
    <View
      flex={1}
      backgroundColor="$secondaryBackground"
      justifyContent="center"
      alignItems="center"
    >
      <LoadingSpinner />
    </View>
  );
}
