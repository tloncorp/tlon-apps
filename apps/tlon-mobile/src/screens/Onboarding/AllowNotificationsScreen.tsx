import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsDarkMode } from '@tloncorp/app/hooks/useDarkMode';
import {
  requestNotificationToken,
  useNotificationPermissions,
} from '@tloncorp/app/lib/notifications';
import { prepareTlonbotRevivalNotifications } from '@tloncorp/app/lib/tlonbotRevivalNotifications';
import {
  Button,
  OnboardingStepLayout,
  TlonText,
  useNotificationPromptFrame,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useRef } from 'react';
import { Image, Platform } from 'react-native';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'AllowNotifications'
>;

const logger = createDevLogger('AllowNotificationsScreen', true);

export const AllowNotificationsScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const isDarkMode = useIsDarkMode();
  const notifPerms = useNotificationPermissions();
  const hasContinued = useRef(false);
  const prompt = useNotificationPromptFrame();

  const getPromptImage = () => {
    if (Platform.OS === 'ios') {
      return isDarkMode
        ? require('../../../assets/images/notif_prompt_ios_dark.png')
        : require('../../../assets/images/notif_prompt_ios_light.png');
    } else {
      return isDarkMode
        ? require('../../../assets/images/notif_prompt_android_dark.png')
        : require('../../../assets/images/notif_prompt_android_light.png');
    }
  };

  const continueOnboarding = useCallback(
    async (notificationToken?: string) => {
      if (hasContinued.current) {
        return;
      }

      hasContinued.current = true;

      // Save the notification token to signup context
      signupContext.setOnboardingValues({
        notificationToken,
      });

      if (signupContext.onboardingFlow === 'tlonbotRevival') {
        await db.tlonbotRevivalSetup.setValue((current) => ({
          ...current,
          pending: true,
          applied: false,
          nickname: signupContext.nickname,
          notificationLevel: signupContext.notificationLevel,
          notificationToken,
        }));
        prepareTlonbotRevivalNotifications(
          notificationToken,
          signupContext.notificationLevel
        );
        signupContext.clear();
        await db.hostedAccountIsInitialized.setValue(true);
        return;
      } else {
        navigation.push('ReserveShip');
      }
    },
    [signupContext, navigation]
  );

  const handleNext = useCallback(async () => {
    let notificationToken: string | undefined;

    try {
      // Request notification permission and get token
      notificationToken = await requestNotificationToken();
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      if (err instanceof Error) {
        logger.trackError('Error requesting notification permission', err);
      }
    }

    await continueOnboarding(notificationToken);
  }, [continueOnboarding]);

  useEffect(() => {
    if (!notifPerms.initialized || hasContinued.current) {
      return;
    }

    if (notifPerms.hasPermission) {
      requestNotificationToken()
        .then((notificationToken) => continueOnboarding(notificationToken))
        .catch((err) => {
          console.error('Error getting notification token:', err);
          if (err instanceof Error) {
            logger.trackError('Error getting notification token', err);
          }
          continueOnboarding();
        });
      return;
    }

    if (!notifPerms.canAskPermission) {
      continueOnboarding();
    }
  }, [
    continueOnboarding,
    notifPerms.canAskPermission,
    notifPerms.hasPermission,
    notifPerms.initialized,
  ]);

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
      body={
        <>
          On the next screen, make sure you tap{' '}
          <TlonText.Text fontWeight="600">“Allow”</TlonText.Text> to enable
          notifications.
        </>
      }
      footer={<Button preset="hero" shadow label="Next" onPress={handleNext} />}
    >
      <Image
        source={getPromptImage()}
        accessibilityLabel="The notification prompt, with an arrow pointing to Allow"
        resizeMode="contain"
        style={{
          width: prompt.width,
          height: prompt.height,
          alignSelf: 'center',
          transform: [{ translateX: prompt.offsetX }],
        }}
      />
    </OnboardingStepLayout>
  );
};
