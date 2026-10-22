import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ub from '@tloncorp/api/urbit';
import { Button, NotificationLevelSelector } from '@tloncorp/app/ui';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  OnboardingStepBody,
  OnboardingStepLayout,
} from '../../components/OnboardingStepLayout';
import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'SetNotifications'
>;

const DEFAULT_NOTIFICATION_LEVEL: ub.NotificationLevel = 'medium';

export const SetNotificationsScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const isRevivalOnboarding = signupContext.onboardingFlow === 'tlonbotRevival';
  const didPrefillNotificationLevel = useRef(false);

  const [selectedLevel, setSelectedLevel] = useState<ub.NotificationLevel>(
    DEFAULT_NOTIFICATION_LEVEL
  );

  useEffect(() => {
    if (!isRevivalOnboarding || didPrefillNotificationLevel.current) {
      return;
    }

    didPrefillNotificationLevel.current = true;
    db.getVolumeSetting('base')
      .then((setting) => {
        if (setting?.level) {
          setSelectedLevel(setting.level);
        }
      })
      .catch(() => {});
  }, [isRevivalOnboarding]);

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
    <OnboardingStepLayout
      title="Notifications"
      footer={<Button preset="hero" shadow label="Next" onPress={handleNext} />}
    >
      <OnboardingStepBody>
        Tlon works best when you’re notified of messages. You can change this
        any time.
      </OnboardingStepBody>
      <NotificationLevelSelector
        value={selectedLevel}
        onChange={setSelectedLevel}
        config={{ shortDescriptions: true }}
        flush
      />
    </OnboardingStepLayout>
  );
};
