import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  SizableText,
  SplashParagraph,
  SplashTitle,
  View,
  XStack,
  YStack,
} from '@tloncorp/app/ui';
import { finishingSelfHostedLogin } from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { usePostHog } from 'posthog-react-native';
import { useCallback, useState } from 'react';
import { Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetTelemetry'>;

export const SetTelemetryScreen = () => {
  const insets = useSafeAreaInsets();
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
    <View
      flex={1}
      backgroundColor="$background"
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
    >
      <YStack flex={1} gap="$2xl" paddingTop="$2xl">
        <SplashTitle>
          Help us improve <Text color="$positiveActionText">Tlon.</Text>
        </SplashTitle>
        <SplashParagraph marginBottom={0}>
          We&rsquo;re trying to make the app better and knowing how people use
          it really helps. These stats are anonymous, for product development
          purposes only, and we don&rsquo;t share them with anyone.
        </SplashParagraph>
        <View paddingHorizontal="$2xl">
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
        </View>
      </YStack>
      <Button
        onPress={handleNext}
        label="Next"
        preset="hero"
        shadow
        marginHorizontal="$2xl"
        marginTop="$xl"
      />
    </View>
  );
};
