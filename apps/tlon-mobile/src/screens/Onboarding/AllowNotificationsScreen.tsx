import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { requestNotificationToken } from '@tloncorp/app/lib/notifications';
import {
  Button,
  Icon,
  ScreenHeader,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import { useCallback, useEffect } from 'react';
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

    // Save the notification token to signup context
    signupContext.setOnboardingValues({
      notificationToken,
    });

    navigation.push('ReserveShip');
  }, [signupContext, navigation]);

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
        <ScreenHeader title="Notifications" showSessionStatus={false} />
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
          <Button
            onPress={handleNext}
            size="large"
            fill="solid"
            type="primary"
            shadow
            centered
            label="Next"
          />
        </YStack>
      </ImageBackground>
    </View>
  );
};
