import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestNotificationToken } from '@tloncorp/app/lib/notifications';
import {
  NotificationLevelSelector,
  ScreenHeader,
  ScrollView,
  TlonText,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import * as ub from '@tloncorp/shared/urbit';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'SetNotifications'
>;

const DEFAULT_NOTIFICATION_LEVEL: ub.NotificationLevel = 'medium';
const logger = createDevLogger('SetNotificationsScreen', true);

export const SetNotificationsScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const insets = useSafeAreaInsets();

  const [selectedLevel, setSelectedLevel] = useState<ub.NotificationLevel>(
    DEFAULT_NOTIFICATION_LEVEL
  );

  const handleNext = useCallback(async () => {
    let notificationToken: string | undefined;

    try {
      notificationToken = await requestNotificationToken();
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      if (err instanceof Error) {
        logger.trackError('Error requesting notification permission', err);
      }
    }

    signupContext.setOnboardingValues({
      notificationLevel: selectedLevel,
      notificationToken,
    });
    navigation.push('ReserveShip');
  }, [selectedLevel, signupContext, navigation]);

  // Disable back button
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        e.preventDefault();
      }),
    [navigation]
  );

  return (
    <View
      flex={1}
      paddingBottom={insets.bottom}
      backgroundColor="$secondaryBackground"
    >
      <ScreenHeader
        title="Notifications"
        showSessionStatus={false}
        rightControls={
          <ScreenHeader.TextButton onPress={handleNext}>
            Next
          </ScreenHeader.TextButton>
        }
      />
      <ScrollView
        flex={1}
        paddingHorizontal="$2xl"
        maxWidth={600}
        marginHorizontal="auto"
      >
        <YStack gap="$2xl" paddingVertical={'$2xl'}>
          <TlonText.Text size="$body">
            <TlonText.Text fontWeight={'600'}>
              Tlon has no attention traps or engagement bait.
            </TlonText.Text>{' '}
            As a messenger, it works best when you’re notified of messages—but
            you’re in control. Customize these settings anytime for any group,
            channel, or DM.
          </TlonText.Text>
          <TlonText.Text size="$body">
            Your device may also ask you to enable push notifications. If you
            want to receive notifications on your device, be sure to allow them
            when prompted.
          </TlonText.Text>
        </YStack>
        <NotificationLevelSelector
          value={selectedLevel}
          onChange={setSelectedLevel}
        />
      </ScrollView>
    </View>
  );
};
