import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import { BootPhaseExplanations } from '@tloncorp/app/lib/bootHelpers';
import { Spinner, Text, View, YStack } from '@tloncorp/ui';
import { useEffect } from 'react';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReserveShip'>;

export const ReserveShipScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();

  // Disable back button once you reach this screen
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        e.preventDefault();
      }),
    [navigation]
  );

  useEffect(() => {
    if (!signupContext.didCompleteSignup) {
      signupContext.setDidCompleteSignup(true);
    }
  }, [signupContext]);

  return (
    <View flex={1} padding="$2xl" alignItems="center" justifyContent="center">
      <YStack alignItems="center" gap="$xl">
        <Spinner size="large" />
        <Text textAlign="center" color="$primaryText">
          Booting your new P2P node for the first time...
        </Text>
        {/* TOOD: add back in when design is ready */}
        {/* <Text textAlign="center" color="$secondaryText" fontSize="$m">
          {BootPhaseExplanations[signupContext.bootPhase]}
        </Text> */}
      </YStack>
    </View>
  );
};
