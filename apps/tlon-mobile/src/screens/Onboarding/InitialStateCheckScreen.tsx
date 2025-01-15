import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShip } from '@tloncorp/app/contexts/ship';
import { AnalyticsEvent, createDevLogger, withRetry } from '@tloncorp/shared';
import { HostedNodeStatus } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  ArvosDiscussing,
  LoadingSpinner,
  OnboardingTextBlock,
  ScreenHeader,
  View,
  useStore,
} from '@tloncorp/ui';
import { useCallback, useEffect } from 'react';

import { useOnboardingHelpers } from '../../hooks/useOnboardingHelpers';
import { useReviveSavedOnboarding } from '../../hooks/useReviveSavedOnboarding';
import { useSignupContext } from '../../lib/signupContext';
import { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'InitialStateCheck'
>;

const logger = createDevLogger('InitialStateCheckScreen', true);

export function InitialStateCheckScreen({ navigation }: Props) {
  const signupContext = useSignupContext();
  const reviveSignupSession = useReviveSavedOnboarding();
  const { reviveLoggedInSession } = useOnboardingHelpers();

  console.log('bl: initial state check render');

  useEffect(() => {
    async function checkInitialState() {
      try {
        const nodeStoppedWhileLoggedIn =
          await db.nodeStoppedWhileLoggedIn.getValue();
        const hostingUserId = await db.hostingUserId.getValue();
        const hasPotentialSignupSession =
          !!signupContext.email || !!signupContext.phoneNumber;
        const hasPotentialLoggedInSession = !!hostingUserId;

        if (nodeStoppedWhileLoggedIn) {
          // TODO: check auth not expired
          logger.log('node stopped while logged in');
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

        // if we didn't return, try to any lingering state
        await db.clearSessionStorageItems();
      } catch (e) {
        logger.trackEvent('Error reviving onboarding session', {
          errorMessage: e.message,
          errorStack: e.stack,
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
  });

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
