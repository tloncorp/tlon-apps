import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import {
  requestNotificationToken,
  useNotificationPermissions,
} from '@tloncorp/app/lib/notifications';
import {
  SplashParagraph,
  SplashTitle,
  TlonText,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
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

export const AllowNotificationsScreen = ({ navigation }: Props) => {
  const signupContext = useSignupContext();
  const insets = useSafeAreaInsets();
  const isDarkMode = useIsDarkMode();
  const notifPerms = useNotificationPermissions();
  const hasContinued = useRef(false);

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

      signupContext.setOnboardingValues({
        notificationToken,
      });

      if (signupContext.isGuidedLogin) {
        signupContext.handlePostSignup();
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
      backgroundColor="$background"
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
    >
      <ImageBackground
        source={getBackgroundImage()}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <YStack flex={1} gap="$2xl" paddingTop="$2xl">
          <SplashTitle>
            Enable <Text color="$positiveActionText">notifications.</Text>
          </SplashTitle>
          <SplashParagraph marginBottom={0}>
            On the next screen, tap{' '}
            <TlonText.RawText fontWeight="600" color="$primaryText">
              &ldquo;Allow&rdquo;
            </TlonText.RawText>{' '}
            to enable notifications.
          </SplashParagraph>
        </YStack>
        <Button
          preset="hero"
          shadow
          label="Next"
          onPress={handleNext}
          marginHorizontal="$xl"
          marginTop="$xl"
        />
      </ImageBackground>
    </View>
  );
};
