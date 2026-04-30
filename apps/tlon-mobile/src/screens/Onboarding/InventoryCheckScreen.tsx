import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignupParams } from '@tloncorp/app/contexts/branch';
import {
  Icon,
  ScreenHeader,
  SplashParagraph,
  SplashTitle,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import { Button, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboardingContext } from '../../lib/OnboardingContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'InventoryCheck'>;

const logger = createDevLogger('InventoryCheckScreen', true);

export const InventoryCheckScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const signupParams = useSignupParams();
  const [isChecking, setIsChecking] = useState(false);
  const { hostingApi } = useOnboardingContext();

  const checkAvailability = async () => {
    setIsChecking(true);

    try {
      const { enabled } = await hostingApi.getHostingAvailability({
        lure: signupParams.lureId,
        priorityToken: signupParams.priorityToken,
      });
      if (enabled) {
        navigation.navigate('Signup');
      } else {
        navigation.navigate('PasteInviteLink');
      }
    } catch (err) {
      console.error('Error checking hosting availability:', err);
      if (err instanceof Error) {
        logger.trackError('Error checking hosting availability', err);
      }
    }

    setIsChecking(false);
  };

  return (
    <View
      flex={1}
      backgroundColor="$background"
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
    >
      <YStack flex={1} gap="$2xl" paddingTop="$2xl">
        <View paddingHorizontal="$xl">
          <ScreenHeader.BackButton
            onPress={isChecking ? undefined : () => navigation.goBack()}
          />
        </View>
        <SplashTitle>
          Welcome to <Text color="$positiveActionText">Tlon.</Text>
        </SplashTitle>
        <SplashParagraph marginBottom={0}>
          Pain-free P2P. Your free account is a cloud computer that you own.
        </SplashParagraph>
        <YStack paddingHorizontal="$xl" gap="$2xl">
          <FeatureRow
            icon="Bang"
            title="Tlon operates on a peer-to-peer network."
            description="Practically, this means your free account is a cloud computer. You can run it yourself, or we can run it for you."
          />
          <FeatureRow
            icon="ChannelTalk"
            title="Hassle-free messaging you can trust."
            description="We'll make sure your computer is online and up-to-date. Interested in self-hosting? You can always change your mind."
          />
          <FeatureRow
            icon="Send"
            title="Sign up with your email address."
            description="We'll ask you a few questions to get you set up."
          />
        </YStack>
      </YStack>
      <Button
        onPress={checkAvailability}
        disabled={isChecking}
        loading={isChecking}
        label={isChecking ? 'Checking…' : 'Get started'}
        preset="hero"
        shadow={!isChecking}
        marginHorizontal="$xl"
        marginTop="$xl"
      />
    </View>
  );
};

function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: 'Bang' | 'ChannelTalk' | 'Send';
  title: string;
  description: string;
}) {
  return (
    <XStack gap="$l">
      <View
        backgroundColor="$secondaryBackground"
        borderRadius="$3xl"
        padding="$m"
      >
        <Icon type={icon} />
      </View>
      <YStack gap="$xs" flex={1}>
        <TlonText.Text size="$body" fontWeight="500">
          {title}
        </TlonText.Text>
        <TlonText.Text size="$label/m" color="$tertiaryText">
          {description}
        </TlonText.Text>
      </YStack>
    </XStack>
  );
}
