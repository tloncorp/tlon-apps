import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { connectNotifyProvider } from '@tloncorp/app/lib/notificationsApi';
import {
  requestNotificationToken,
  useNotificationPermissions,
} from '@tloncorp/app/lib/notifications';
import { Button, ScreenHeader, TlonText, View, YStack } from '@tloncorp/app/ui';
import { createDevLogger, withRetry } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useRef } from 'react';
import { ImageBackground, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'AllowNotifications'
>;

const logger = createDevLogger('AllowNotificationsScreen', true);

async function registerTlonbotRevivalNotificationToken(
  notificationToken?: string
) {
  if (!notificationToken) {
    return;
  }

  await withRetry(() => connectNotifyProvider(notificationToken), {
    startingDelay: 750,
    numOfAttempts: 4,
    maxDelay: 4000,
  }).catch((error) => {
    logger.trackError('TlonBot revival early notification token update failed', {
      error,
    });
  });
}

export const AllowNotificationsScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const insets = useSafeAreaInsets();
  const isDarkMode = useIsDarkMode();
  const notifPerms = useNotificationPermissions();
  const hasContinued = useRef(false);

  // Select background image based on platform and theme
  const getBackgroundImage = () => {
    if (Platform.OS === 'ios') {
      return isDarkMode
        ? require('../../../assets/images/notif_hint_iOS_dark.png')
        : require('../../../assets/images/notif_hint_iOS_light.png');
    } else {
      return isDarkMode
        ? require('../../../assets/images/notif_hint_android_dark.png')
        : require('../../../assets/images/notif_hint_android_light.png');
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

      if (
        signupContext.onboardingFlow === 'traditionalRevival' ||
        signupContext.onboardingFlow === 'tlonbotRevival' ||
        signupContext.isGuidedLogin
      ) {
        if (signupContext.onboardingFlow === 'tlonbotRevival') {
          const shipId = await db.hostedUserNodeId.getValue();
          await db.tlonbotRevivalSetup.setValue((current) => ({
            ...current,
            pending: true,
            applied: false,
            shipId: shipId ?? current.shipId,
            nickname: signupContext.nickname,
            notificationLevel: signupContext.notificationLevel,
            notificationToken,
          }));
          await registerTlonbotRevivalNotificationToken(notificationToken);
          signupContext.clear();
          await db.hostedAccountIsInitialized.setValue(true);
          return;
        }

        signupContext.handlePostRevivalOnboarding({ notificationToken });
        await db.hostedAccountIsInitialized.setValue(true);
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
    <View
      flex={1}
      paddingBottom={insets.bottom}
      backgroundColor="$secondaryBackground"
    >
      <ImageBackground
        source={getBackgroundImage()}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <ScreenHeader
          backgroundColor="$secondaryBackground"
          title="Notifications"
        />
        <YStack
          flex={1}
          paddingHorizontal="$2xl"
          maxWidth={600}
          marginHorizontal="auto"
          justifyContent="space-between"
        >
          <YStack gap="$l" marginTop="$6xl">
            <TlonText.Text textAlign="center" size="$body">
              On the next screen, make sure you tap
            </TlonText.Text>
            <TlonText.Text textAlign="center" size="$body">
              <TlonText.Text fontWeight={'600'}>“Allow”</TlonText.Text> to
              enable notifications.
            </TlonText.Text>
          </YStack>
          <Button preset="hero" shadow label="Next" onPress={handleNext} />
        </YStack>
      </ImageBackground>
    </View>
  );
};
