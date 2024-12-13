import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenHeader,
  SizableText,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { Switch } from 'react-native';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetNickname'>;

export function PhoneDiscoveryScreen({
  navigation,
  route: {
    params: { user },
  },
}: Props) {
  const signupContext = useSignupContext();
  const [isEnabled, setIsEnabled] = useState(false);

  const handleNext = useCallback(() => {
    if (isEnabled) {
      signupContext.setOnboardingValues({ shouldMarkPhoneVerified: true });
    }
    navigation.push('ReserveShip', {
      user,
    });
  }, [isEnabled, navigation, signupContext, user]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Contact Discovery"
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
            If enabled, anyone who has your phone number in their contact book
            can find you on Tlon.
          </TlonText.Text>
          <TlonText.Text size="$body" color="$primaryText">
            Your phone number will not be publically visible.
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
            Enable contact discovery
          </SizableText>
          <Switch value={isEnabled} onValueChange={setIsEnabled} />
        </XStack>
      </YStack>
    </View>
  );
}
