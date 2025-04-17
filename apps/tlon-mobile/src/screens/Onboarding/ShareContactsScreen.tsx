import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  PrimaryButton,
  ScreenHeader,
  View,
  YStack,
  useStore,
} from '@tloncorp/app/ui';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import * as Contacts from 'expo-contacts';
import { useState } from 'react';

import { useContactPermissions } from '../../hooks/useContactPermissions';
import { processNativeContacts } from '../../lib/contactsHelpers';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ShareContacts'>;

const logger = createDevLogger('ShareContactsScreen', true);

export const ShareContactsScreen = ({ navigation }: Props) => {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const perms = useContactPermissions();

  const processContacts = async () => {
    try {
      setIsProcessing(true);
      const { data: nativeContactBook } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });
      const processedContacts = processNativeContacts(nativeContactBook);
      await store.importSystemContactBook(processedContacts);

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
    <View flex={1} backgroundColor={'$secondaryBackground'}>
      <ScreenHeader title="Share Contacts" showSessionStatus={false} />
      <View flex={1} paddingHorizontal="$2xl">
        <YStack marginTop="$xl" gap="$xl">
          <Text size="$label/l">
            Tlon Messenger can use your contact book to find your friends who
            are already on the app and help you invite the ones who aren't.
          </Text>
          <Text size="$label/l">
            We&apos;ll never share your contacts with anyone or store them on
            our servers.
          </Text>
        </YStack>
        {error && (
          <Text marginVertical="$m" size="$label/m" color="$red">
            {error}
          </Text>
        )}
        <YStack marginTop="$3xl" gap="$l" flex={1} paddingBottom="$xl">
          {isProcessing && <LoadingSpinner />}
          {(perms.hasPermission || perms.canAskPermission) && (
            <>
              <PrimaryButton
                loading={perms.isLoading || isProcessing}
                onPress={handleShareContacts}
              >
                Sync Contacts
              </PrimaryButton>
              <Button secondary onPress={handleSkip}>
                <Button.Text>Skip</Button.Text>
              </Button>
            </>
          )}
        </YStack>
      </View>
    </View>
  );
};
