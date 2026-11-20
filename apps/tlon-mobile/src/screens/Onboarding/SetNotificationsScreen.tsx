import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ub from '@tloncorp/api/urbit';
import {
  ART_TO_CONTENT_GAP,
  LineChoiceList,
  LineStepFrame,
  NotificationsArt,
  useNotificationLevelOptions,
} from '@tloncorp/app/ui';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'SetNotifications'
>;

const DEFAULT_NOTIFICATION_LEVEL: ub.NotificationLevel = 'medium';

// What each level lets through to your phone, as the drawing shows it:
// direct messages, mentions, workspace posts.
const LETS_THROUGH: Partial<Record<ub.NotificationLevel, boolean[]>> = {
  loud: [true, true, true],
  medium: [true, true, true],
  soft: [true, true, false],
  hush: [false, false, false],
};

export const SetNotificationsScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const isRevivalOnboarding = signupContext.onboardingFlow === 'tlonbotRevival';
  const didPrefillNotificationLevel = useRef(false);

  const [selectedLevel, setSelectedLevel] = useState<ub.NotificationLevel>(
    DEFAULT_NOTIFICATION_LEVEL
  );
  const levels = useNotificationLevelOptions({ shortDescriptions: true });

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

  // No back arrow: going back from here is blocked, as on Profile.
  return (
    <LineStepFrame
      step={2}
      title="Notifications"
      subtitle="Tlon works best when you’re notified of messages. You can change this any time."
      primary={{
        label: 'Next',
        onPress: handleNext,
        testID: 'set-notifications-next',
      }}
      testID="set-notifications"
    >
      <NotificationsArt
        through={LETS_THROUGH[selectedLevel] ?? [false, false, false]}
      />
      <LineChoiceList
        marginTop={ART_TO_CONTENT_GAP}
        accessibilityLabel="Notification level"
        choices={levels.map((level) => ({
          id: level.value,
          title: level.title,
          testID: `notification-level-${level.value}`,
        }))}
        selectedId={selectedLevel}
        onSelect={(level) => setSelectedLevel(level as ub.NotificationLevel)}
      />
    </LineStepFrame>
  );
};
