import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { finishingSelfHostedLogin } from '@tloncorp/shared/db';
import {
  ScreenHeader,
  SizableText,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { usePostHog } from 'posthog-react-native';
import { useCallback, useState } from 'react';
import { Switch } from 'react-native';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetTelemetry'>;

export const SetTelemetryScreen = () => {
  const posthog = usePostHog();
  const [isEnabled, setIsEnabled] = useState(false);
  const { setValue: setFinishingSelfHostedLogin } =
    finishingSelfHostedLogin.useStorageItem();

  const handleNext = useCallback(() => {
    if (!isEnabled) {
      posthog?.optOut();
    }
    setFinishingSelfHostedLogin(false);
  }, [isEnabled, posthog, setFinishingSelfHostedLogin]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Usage Statistics"
        showSessionStatus={false}
        rightControls={
          <ScreenHeader.TextButton onPress={handleNext}>
            Next
          </ScreenHeader.TextButton>
        }
      />
      <YStack gap="$xl" paddingHorizontal="$2xl">
        <View padding="$xl">
          <TlonText.Text size="$body" color="$primaryText" marginBottom="$2xl">
            We&rsquo;re trying to make the app better and knowing how people use
            the app really helps.
          </TlonText.Text>
          <TlonText.Text size="$body" color="$primaryText">
            These stats are anonymous, for product development purposes only,
            and we don&rsquo;t share them with anyone.
          </TlonText.Text>
        </View>

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
