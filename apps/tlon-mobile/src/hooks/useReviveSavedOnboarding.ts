import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared/dist';
import { SignupParams, signupData } from '@tloncorp/shared/dist/db';
import { useShip } from 'packages/app/contexts/ship';
import { useCallback, useEffect } from 'react';

import { useOnboardingContext } from '../lib/OnboardingContext';
import { OnboardingStackParamList } from '../types';

const logger = createDevLogger('OnboardingRevive', true);

export function useReviveSavedOnboarding() {
  const inviteMeta = useLureMetadata();
  const navigation = useNavigation<NavigationProp<OnboardingStackParamList>>();
  const { hostingApi } = useOnboardingContext();
  const { isAuthenticated } = useShip();
  const signupContext = useSignupContext();

  const getOnboardingRouteStack = useCallback(
    async (savedSignup: SignupParams) => {
      if (!savedSignup.email || !savedSignup.password) {
        logger.log('no stored email or password');
        return null;
      }

      const stack: { name: keyof OnboardingStackParamList; params?: any }[] = [
        { name: 'Welcome' },
        { name: 'SignUpEmail' },
        {
          name: 'SignUpPassword',
          params: {
            email: savedSignup.email,
          },
        },
      ];

      logger.log('getting hosting user', {
        email: savedSignup.email,
        password: savedSignup.password,
      });
      const user = await hostingApi.logInHostingUser({
        email: savedSignup.email,
        password: savedSignup.password,
      });
      logger.log(`got hosting user`, user);

      if (user.requirePhoneNumberVerification) {
        logger.log(`needs phone verify`);
        stack.push({ name: 'RequestPhoneVerify', params: { user } });
        return stack;
      }

      if (!user.verified) {
        logger.log(`need email verify`);
        stack.push({ name: 'CheckVerify', params: { user } });
        return stack;
      }

      stack.push({ name: 'SetNickname', params: { user } });
      if (!savedSignup.nickname) {
        logger.log('needs nickname');
        return stack;
      }

      stack.push({ name: 'SetTelemetry', params: { user } });
      if (savedSignup.telemetry === undefined) {
        logger.log('needs telemetry');
        return stack;
      }

      logger.log('ready to reserve ship');
      stack.push({ name: 'ReserveShip', params: { user } });
      return stack;
    },
    [hostingApi]
  );

  const execute = useCallback(async () => {
    const savedSignup = await signupData.getValue();
    if (!savedSignup.email) {
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
      logger.log(`attempting to revive onboarding session`, savedSignup);
      const routeStack = await getOnboardingRouteStack(savedSignup);
      logger.log(`computed onboarding route stack`, routeStack);

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
    }
  }, []);
}
