import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignupParams } from '@tloncorp/app/contexts/branch';
import {
  IconType,
  ListItem,
  ScreenHeader,
  SplashParagraph,
  SplashTitle,
  View,
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
          Welcome to <Text color="$positiveActionText">Tlon Messenger.</Text>
        </SplashTitle>
        <SplashParagraph marginTop="$l" marginBottom={0}>
          A messenger that you own completely, running on your own personal
          server.
        </SplashParagraph>
        <YStack paddingHorizontal="$l" gap="$2xl" marginTop="$2xl">
          <FeatureRow
            icon="Home"
            title="Tlon runs on your own personal server."
            description="Your free account is a cloud computer. We run it for you, or you can run it yourself."
          />
          <FeatureRow
            icon="ChannelTalk"
            title="Hassle-free messaging you can trust."
            description="We'll keep your server online and up-to-date. Interested in self-hosting? You can change your mind any time."
          />
          <FeatureRow
            icon="Mail"
            title="Sign up with email or phone."
            description="We'll ask a few questions to get you set up."
            align="center"
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
  align = 'flex-start',
}: {
  icon: IconType;
  title: string;
  description: string;
  align?: 'flex-start' | 'center';
}) {
  return (
    <ListItem
      backgroundColor="unset"
      padding="$s"
      height="auto"
      alignItems={align}
    >
      <ListItem.SystemIcon
        icon={icon}
        backgroundColor="unset"
        color="$primaryText"
      />
      <ListItem.MainContent height="auto">
        <ListItem.Title fontWeight="600" marginBottom="$m">
          {title}
        </ListItem.Title>
        <ListItem.Subtitle numberOfLines={0}>{description}</ListItem.Subtitle>
      </ListItem.MainContent>
    </ListItem>
  );
}
