import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ub from '@tloncorp/api/urbit';
import {
  requestNotificationToken,
  useNotificationPermissions,
} from '@tloncorp/app/lib/notifications';
import { prepareTlonbotRevivalNotifications } from '@tloncorp/app/lib/tlonbotRevivalNotifications';
import {
  LineChoiceList,
  LineStepFrame,
  useNotificationLevelOptions,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'SetNotifications'
>;

const logger = createDevLogger('SetNotificationsScreen', true);

const DEFAULT_NOTIFICATION_LEVEL: ub.NotificationLevel = 'medium';

/**
 * Notifications, step 2: pick a level, then Enable notifications brings up
 * the system prompt right here. Either answer goes on to Setting up. With
 * Nothing picked, the button is Next and nothing is asked.
 */
export const SetNotificationsScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const isRevivalOnboarding = signupContext.onboardingFlow === 'tlonbotRevival';
  const notifPerms = useNotificationPermissions();
  const didPrefillNotificationLevel = useRef(false);
  const hasContinued = useRef(false);
  const [asking, setAsking] = useState(false);

  const [selectedLevel, setSelectedLevel] = useState<ub.NotificationLevel>(
    DEFAULT_NOTIFICATION_LEVEL
  );
  const levels = useNotificationLevelOptions({ shortDescriptions: true });
  const wantsNotifications = selectedLevel !== 'hush';

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

  const continueOnboarding = useCallback(
    async (notificationToken?: string) => {
      signupContext.setOnboardingValues({
        notificationLevel: selectedLevel,
        notificationToken,
      });

      if (isRevivalOnboarding) {
        await db.tlonbotRevivalSetup.setValue((current) => ({
          ...current,
          pending: true,
          applied: false,
          nickname: signupContext.nickname,
          notificationLevel: selectedLevel,
          notificationToken,
        }));
        prepareTlonbotRevivalNotifications(notificationToken, selectedLevel);
        signupContext.clear();
        await db.hostedAccountIsInitialized.setValue(true);
        return;
      }
      navigation.push('ReserveShip');
    },
    [isRevivalOnboarding, navigation, selectedLevel, signupContext]
  );

  const handleNext = useCallback(async () => {
    if (hasContinued.current) {
      return;
    }
    hasContinued.current = true;

    let notificationToken: string | undefined;
    // Nothing never brings up the prompt, but a phone that already allows
    // notifications still hands over its token, as before.
    if (wantsNotifications || notifPerms.hasPermission) {
      setAsking(true);
      try {
        // Shows the system prompt the first time; once answered, it returns
        // the token, or nothing if notifications were turned down.
        notificationToken = await requestNotificationToken();
      } catch (err) {
        console.error('Error requesting notification permission:', err);
        if (err instanceof Error) {
          logger.trackError('Error requesting notification permission', err);
        }
      }
    }

    await continueOnboarding(notificationToken);
  }, [continueOnboarding, notifPerms.hasPermission, wantsNotifications]);

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
        label: wantsNotifications ? 'Enable notifications' : 'Next',
        onPress: handleNext,
        loading: asking,
        testID: 'set-notifications-next',
      }}
      testID="set-notifications"
    >
      <LineChoiceList
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
