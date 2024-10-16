import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import {
  NodeInitStatusWidget,
  Spinner,
  Text,
  View,
  YStack,
} from '@tloncorp/ui';
import { useEffect } from 'react';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReserveShip'>;

export const ReserveShipScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const lureMeta = useLureMetadata();

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
          Setting up your new p2p node
        </Text>
        {/* <Text textAlign="center" color="$secondaryText" fontSize="$m">
          {BootPhaseExplanations[signupContext.bootPhase]}
        </Text> */}
        <NodeInitStatusWidget
          bootPhase={signupContext.bootPhase}
          hasInvite={Boolean(lureMeta)}
        />
      </YStack>
    </View>
  );
};
