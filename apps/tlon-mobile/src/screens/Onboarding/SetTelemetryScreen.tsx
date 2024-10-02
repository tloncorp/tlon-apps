import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import {
  PrimaryButton,
  ScreenHeader,
  SizableText,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { usePostHog } from 'posthog-react-native';
import { useCallback, useState } from 'react';
import { Switch } from 'react-native';
import branch from 'react-native-branch';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetTelemetry'>;

export const SetTelemetryScreen = ({
  navigation,
  route: {
    params: { user },
  },
}: Props) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const postHog = usePostHog();
  const signupContext = useSignupContext();

  const handleNext = useCallback(() => {
    signupContext.setTelemetry(isEnabled);

    if (!isEnabled) {
      postHog?.optOut();
      branch.disableTracking(true);
    }

    navigation.push('ReserveShip', {
      user,
    });
  }, [isEnabled, user, postHog, navigation, signupContext]);

  return (
    <View flex={1}>
      <ScreenHeader title="Usage Statistics" showSessionStatus={false} />
      <YStack gap="$3xl" padding="$2xl">
        <SizableText color="$primaryText">
          We&rsquo;re trying to make the app better and knowing how people use
          the app really helps.
        </SizableText>
        <XStack
          backgroundColor="$background"
          borderRadius="$l"
          borderWidth={1}
          borderColor="$border"
          paddingHorizontal="$xl"
          paddingVertical="$l"
          alignItems="center"
          justifyContent="space-between"
        >
          <SizableText color="$primaryText">
            Enable anonymous usage stats
          </SizableText>
          <Switch value={isEnabled} onValueChange={setIsEnabled} />
        </XStack>
        <PrimaryButton onPress={handleNext}>Next</PrimaryButton>
      </YStack>
    </View>
  );
};
