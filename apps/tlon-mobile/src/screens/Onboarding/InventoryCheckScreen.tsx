import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignupParams } from '@tloncorp/app/contexts/branch';
import { trackError } from '@tloncorp/app/utils/posthog';
import {
  Icon,
  PrimaryButton,
  ScreenHeader,
  SizableText,
  Text,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { useState } from 'react';
import { Image } from 'react-native';

import { useOnboardingContext } from '../../lib/OnboardingContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'InventoryCheck'>;

export const InventoryCheckScreen = ({ navigation }: Props) => {
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
        navigation.navigate('SignUpEmail');
      } else {
        navigation.navigate('PasteInviteLink');
      }
    } catch (err) {
      console.error('Error checking hosting availability:', err);
      if (err instanceof Error) {
        trackError(err);
      }
    }

    setIsChecking(false);
  };

  return (
    <View flex={1}>
      <ScreenHeader
        title="Welcome to Tlon"
        showSessionStatus={false}
        backAction={() => navigation.goBack()}
        isLoading={isChecking}
      />

      <YStack gap="$2xl" padding="$2xl">
        <View borderRadius="$xl" overflow="hidden">
          <Image style={{ width: '100%', height: 188 }} resizeMode={'cover'} />
        </View>

        <View>
          <SizableText fontSize="$xl">Pain-free P2P</SizableText>
        </View>

        <XStack gap="$l">
          <View>
            <View
              backgroundColor={'$secondaryBackground'}
              borderRadius={'$3xl'}
              padding="$m"
            >
              <Icon type="Bang" />
            </View>
          </View>
          <YStack gap="$xs" flex={1}>
            <Text fontWeight="$xl">
              Tlon operates on a peer-to-peer network.
            </Text>
            <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
              Practically, this means your free account is a cloud computer. You
              can run it yourself, or we can run it for you.
            </Text>
          </YStack>
        </XStack>

        <XStack gap="$l">
          <View>
            <View
              backgroundColor={'$secondaryBackground'}
              borderRadius={'$3xl'}
              padding="$m"
            >
              <Icon type="ChannelTalk" />
            </View>
          </View>
          <YStack gap="$xs" flex={1}>
            <Text fontWeight="$xl">Hassle-free messaging you can trust.</Text>
            <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
              We'll make sure your computer is online and up-to-date. Interested
              in self-hosting? You can always change your mind.
            </Text>
          </YStack>
        </XStack>

        <XStack gap="$l">
          <View>
            <View
              backgroundColor={'$secondaryBackground'}
              borderRadius={'$3xl'}
              padding="$m"
            >
              <Icon type="Send" />
            </View>
          </View>
          <YStack gap="$xs" flex={1}>
            <Text fontWeight="$xl">Sign up with your email address.</Text>
            <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
              We'll ask you a few questions to get you set up.
            </Text>
          </YStack>
        </XStack>

        <PrimaryButton onPress={checkAvailability} disabled={isChecking}>
          Get Started
        </PrimaryButton>
      </YStack>
    </View>
  );
};
