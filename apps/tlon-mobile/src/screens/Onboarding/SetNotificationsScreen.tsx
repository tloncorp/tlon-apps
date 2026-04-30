import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ub from '@tloncorp/api/urbit';
import {
  NotificationLevelSelector,
  SplashParagraph,
  SplashTitle,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { Button, Text } from '@tloncorp/ui';
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
    signupContext.setOnboardingValues({
      notificationLevel: selectedLevel,
    });
    navigation.push('AllowNotifications');
  }, [selectedLevel, signupContext, navigation]);

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
      backgroundColor="$background"
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
    >
      <YStack flex={1} gap="$2xl" paddingTop="$2xl">
        <SplashTitle>
          Pick your <Text color="$positiveActionText">notifications.</Text>
        </SplashTitle>
        <SplashParagraph marginBottom={0}>
          Tlon works best when you&rsquo;re notified of messages. You can change
          these settings any time.
        </SplashParagraph>
        <View
          paddingHorizontal="$xl"
          maxWidth={600}
          width="100%"
          marginHorizontal="auto"
        >
          <NotificationLevelSelector
            value={selectedLevel}
            onChange={setSelectedLevel}
            config={{ shortDescriptions: true }}
          />
        </View>
      </YStack>
      <Button
        preset="hero"
        shadow
        label="Next"
        onPress={handleNext}
        marginHorizontal="$xl"
        marginTop="$xl"
      />
    </View>
  );
};
