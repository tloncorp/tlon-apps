import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  NotificationLevelSelector,
  ScreenHeader,
  TlonText,
  View,
  YStack,
} from '@tloncorp/app/ui';
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

export const SetNotificationsScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const insets = useSafeAreaInsets();

  const [selectedLevel, setSelectedLevel] = useState<ub.NotificationLevel>(
    DEFAULT_NOTIFICATION_LEVEL
  );

  const handleNext = useCallback(async () => {
    // Save the notification level, but don't request token yet
    // That will happen in AllowNotificationsScreen
    signupContext.setOnboardingValues({
      notificationLevel: selectedLevel,
    });
    navigation.push('AllowNotifications');
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
      <ScreenHeader title="Notifications" showSessionStatus={false} />
      <View
        flex={1}
        paddingHorizontal="$2xl"
        maxWidth={600}
        marginHorizontal="auto"
        alignContent="center"
      >
        <YStack gap="$2xl" flex={1} justifyContent="center">
          <TlonText.Text size="$body">
            Tlon works best when you’re notified of messages–but you’re in
            control. You can customize these settings anytime for any DM or
            group.
          </TlonText.Text>

          <NotificationLevelSelector
            value={selectedLevel}
            onChange={setSelectedLevel}
            config={{ shortDescriptions: true }}
          />
        </YStack>
        <Button
          onPress={handleNext}
          size="large"
          fill="solid"
          type="primary"
          shadow
          centered
          label="Next"
        />
      </View>
    </View>
  );
};
