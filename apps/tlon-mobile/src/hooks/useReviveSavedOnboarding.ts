import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { SignupParams, signupData } from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';

import { useSignupContext } from '../lib/signupContext';
import { OnboardingStackParamList } from '../types';

const logger = createDevLogger('OnboardingRevive', true);

export function useReviveSavedOnboarding() {
  const [reviveAttemptComplete, setReviveAttemptComplete] = useState(false);
  const inviteMeta = useLureMetadata();
  const navigation = useNavigation<NavigationProp<OnboardingStackParamList>>();
  const { isAuthenticated } = useShip();
  const signupContext = useSignupContext();

  const getOnboardingRouteStack = useCallback(
    async (savedSignup: SignupParams) => {
      if (!savedSignup.email && !savedSignup.phoneNumber) {
        logger.log('no stored signup method');
        return null;
      }

      const stack: { name: keyof OnboardingStackParamList; params?: any }[] = [
        { name: 'Welcome' },
        { name: 'Signup' },
      ];

      const user = savedSignup.hostingUser;
      if (!user || !user.verified) {
        logger.log('needs OTP check');
        const otpMethod = savedSignup.phoneNumber ? 'phone' : 'email';
        stack.push({ name: 'CheckOTP', params: { mode: 'signup', otpMethod } });
        return stack;
      }

      if (user.requirePhoneNumberVerification) {
        logger.log(`needs phone verify`);
        stack.push({ name: 'RequestPhoneVerify', params: { user } });
        return stack;
      }

      stack.push({ name: 'SetNickname', params: { user } });
      if (!savedSignup.nickname) {
        logger.log('needs nickname');
        return stack;
      }

      logger.log('ready to reserve ship');
      stack.push({ name: 'ReserveShip', params: { user } });
      return stack;
    },
    []
  );

  const execute = useCallback(async () => {
    const savedSignup = await signupData.getValue();
    if (!savedSignup.email && !savedSignup.phoneNumber) {
      logger.log('no saved onboarding session found');
      return;
    }

    if (isAuthenticated) {
      logger.log(
        'found saved session, but already authenticated. Running post signup logic'
      );
      signupContext.handlePostSignup();
      return;
    }

    if (inviteMeta) {
      logger.crumb(`attempting to revive onboarding session`, {
        email: savedSignup.email,
        phoneNumber: savedSignup.phoneNumber,
      });
      const routeStack = await getOnboardingRouteStack(savedSignup);
      logger.crumb(`computed onboarding route stack`, routeStack);

      if (routeStack) {
        logger.trackEvent(AnalyticsEvent.OnboardingSessionRevived, {
          route: routeStack[routeStack.length - 1],
        });
        navigation.reset({
          index: 1,
          routes: routeStack,
        });
      }
    }
  }, [
    getOnboardingRouteStack,
    inviteMeta,
    isAuthenticated,
    navigation,
    signupContext,
  ]);

  useEffect(() => {
    try {
      execute();
    } catch (e) {
      logger.trackError('Error reviving onboarding', {
        errorMessage: e.message,
        errorStack: e.stack,
      });
    } finally {
      setTimeout(() => signupContext.markReviveCheckComplete(), 100);
    }
  }, []);

  return reviveAttemptComplete;
}
