import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useActiveTheme } from '@tloncorp/app/provider';
import {
  Image,
  PrimaryButton,
  ScreenHeader,
  View,
  XStack,
  YStack,
  useStore,
} from '@tloncorp/app/ui';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useContactPermissions } from '../../hooks/useContactPermissions';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ShareContacts'>;

const logger = createDevLogger('ShareContactsScreen', true);

export const ShareContactsScreen = ({ navigation }: Props) => {
  const activeTheme = useActiveTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const perms = useContactPermissions();

  const facesImage =
    activeTheme === 'dark'
      ? require('../../../assets/images/faces-dark.png')
      : require('../../../assets/images/faces.png');

  const processContacts = async () => {
    try {
      setIsProcessing(true);
      await store.syncSystemContacts();
      // if successful, continue onboarding
      navigation.navigate('ReserveShip');
    } catch (error) {
      setError('Something went wrong, please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareContacts = async () => {
    if (perms.canAskPermission) {
      logger.trackEvent(AnalyticsEvent.ActionContactBookPermRequested);
      const status = await perms.requestPermissions();
      if (status === 'granted') {
        logger.trackEvent(AnalyticsEvent.ActionContactBookPermGranted);
        processContacts();
      } else if (status === 'denied') {
        logger.trackEvent(AnalyticsEvent.ActionContactBookPermDenied);
      }
    } else if (perms.hasPermission) {
      processContacts();
    }
  };

  const handleSkip = () => {
    logger.trackEvent(AnalyticsEvent.ActionContactBookSkipped);
    navigation.navigate('ReserveShip');
  };

  return (
    <View
      flex={1}
      paddingBottom={insets.bottom}
      backgroundColor={'$secondaryBackground'}
    >
      <ScreenHeader
        title="Find your friends on Tlon"
        showSessionStatus={false}
      />
      <View flex={1} paddingHorizontal="$2xl">
        <YStack marginTop="$xl" marginHorizontal="$2xl" gap="$xl">
          <Text size="$label/l" textAlign="center" color="$secondaryText">
            Sync your contact book to easily find people you know on Tlon.
          </Text>
        </YStack>
        {error && (
          <Text marginVertical="$m" size="$label/m" color="$red">
            {error}
          </Text>
        )}
        <XStack
          flex={1}
          justifyContent="center"
          alignItems="center"
          marginTop="$xl"
        >
          <Image height={155} aspectRatio={862 / 609} source={facesImage} />
        </XStack>
        <YStack justifyContent="flex-end" gap="$l" paddingBottom="$xl">
          {isProcessing && <LoadingSpinner />}
          <PrimaryButton
            loading={perms.isLoading || isProcessing}
            onPress={handleShareContacts}
          >
            Continue
          </PrimaryButton>
          <Button
            secondary
            backgroundColor="$secondaryBackground"
            disabled={isProcessing}
            onPress={handleSkip}
          >
            <Button.Text fontWeight="500">Skip</Button.Text>
          </Button>
        </YStack>
      </View>
    </View>
  );
};
