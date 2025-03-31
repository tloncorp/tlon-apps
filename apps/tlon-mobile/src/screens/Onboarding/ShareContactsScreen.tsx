import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, ScreenHeader, View, YStack } from '@tloncorp/app/ui';
import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import * as Contacts from 'expo-contacts';
import { useState } from 'react';

import { useContactPermissions } from '../../hooks/useContactPermissions';
import { processNativeContacts } from '../../lib/contactsHelpers';
import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ShareContacts'>;

export const ShareContactsScreen = ({ navigation }: Props) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const signup = useSignupContext();
  const perms = useContactPermissions();

  const processContacts = async () => {
    console.log('processing contacts');
    try {
      setIsProcessing(true);

      // Fetch contacts
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      console.log(`Processing ${data.length} contacts`, data);

      const processed = processNativeContacts(data);
      console.log('Processed contacts:', processed);

      // TODO: Implement actual contact processing
      // This will hash phone numbers/emails and send to your API

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('Error processing contacts:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareContacts = async () => {
    if (perms.canAskPermission) {
      console.log('requesting perms');
      const status = await perms.requestPermissions();
      if (status === 'granted') {
        processContacts();
      }
    } else if (perms.hasPermission) {
      console.log('already have perms, processing');
      processContacts();
    }
  };

  const handleSkip = () => {
    navigation.navigate('ReserveShip');
  };

  return (
    <View flex={1} backgroundColor={'$secondaryBackground'}>
      <ScreenHeader title="Sync Contacts" showSessionStatus={false} />
      <View flex={1} paddingHorizontal="$2xl">
        <YStack marginTop="$xl" gap="$xl">
          <Text size="$label/l">
            Tlon Messenger can use your contact book to find friends who are
            already on the network.
          </Text>
          <Text size="$label/l">
            We&apos;ll never share your contacts or store them on our servers.
          </Text>
        </YStack>
        <YStack marginTop="$3xl" gap="$l" flex={1} paddingBottom="$xl">
          {isProcessing && <LoadingSpinner />}
          {perms.canAskPermission ||
            (perms.hasPermission && (
              <>
                <PrimaryButton
                  loading={perms.isLoading}
                  onPress={handleShareContacts}
                >
                  Sync Contacts
                </PrimaryButton>
                <Button secondary onPress={handleSkip}>
                  <Button.Text>Skip</Button.Text>
                </Button>
              </>
            ))}
        </YStack>
      </View>
    </View>
  );
};
