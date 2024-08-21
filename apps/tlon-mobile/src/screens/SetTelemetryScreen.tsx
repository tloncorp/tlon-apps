import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  GenericHeader,
  SizableText,
  Text,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { usePostHog } from 'posthog-react-native';
import { useCallback, useState } from 'react';
import { Switch } from 'react-native';
import branch from 'react-native-branch';

import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetTelemetry'>;

export const SetTelemetryScreen = ({
  navigation,
  route: {
    params: { user, signUpExtras },
  },
}: Props) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const postHog = usePostHog();

  const handleNext = useCallback(() => {
    if (!isEnabled) {
      postHog?.optOut();
      branch.disableTracking(true);
    }

    navigation.push('ReserveShip', {
      user,
      signUpExtras: { ...signUpExtras, telemetry: isEnabled },
    });
  }, [isEnabled, user, postHog, navigation, signUpExtras]);

  return (
    <View flex={1}>
      <GenericHeader
        title="Usage Statistics"
        rightContent={
          <Button minimal onPress={handleNext}>
            <Text fontSize="$m">Next</Text>
          </Button>
        }
      />
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
      </YStack>
    </View>
  );
};
