import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SettingUpScreen, setupStepForBootPhase } from '@tloncorp/app/ui';
import { NodeBootPhase } from '@tloncorp/shared/domain';
import { useEffect } from 'react';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReserveShip'>;

export const ReserveShipScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const isReady = signupContext.bootPhase >= NodeBootPhase.READY;

  // Disable back button once you reach this screen
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        e.preventDefault();
      }),
    [navigation]
  );

  useEffect(() => {
    if (!signupContext.didCompleteOnboarding) {
      signupContext.setOnboardingValues({ didCompleteOnboarding: true });
    }
    signupContext.kickOffBootSequence();
  }, [signupContext]);

  return (
    <SettingUpScreen
      body={
        isReady
          ? 'Your Tlon computer is ready. Taking you in now.'
          : "We're getting your Tlon computer ready. You'll go straight in when it's done."
      }
      current={setupStepForBootPhase(signupContext.bootPhase)}
    />
  );
};
