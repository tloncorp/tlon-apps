import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
      <ScreenHeader title="Notifications" showSessionStatus={false} />
      <YStack
        flex={1}
        paddingHorizontal="$2xl"
        maxWidth={600}
        marginHorizontal="auto"
        justifyContent="center"
        gap="$3xl"
      >
        <YStack flex={1} justifyContent="center" alignItems="center">
          <View
            borderRadius={'$2xl'}
            backgroundColor={'$border'}
            width={300}
            padding={'$xl'}
            gap={'$l'}
          >
            <TlonText.Text textAlign="center" size="$body">
              On the next screen,
            </TlonText.Text>
            <TlonText.Text textAlign="center" size="$body">
              make sure you tap
            </TlonText.Text>
            <TlonText.Text textAlign="center" size="$body">
              “Allow” to enable notifications
            </TlonText.Text>
            <XStack justifyContent="flex-end" marginTop="$xl">
              <Button
                backgroundColor="$primaryText"
                paddingHorizontal="$2xl"
                paddingVertical={'$l'}
                borderRadius={'$3xl'}
              >
                <Button.Text color={'$background'}>Allow</Button.Text>
              </Button>
            </XStack>
          </View>
          <XStack width={230} justifyContent="flex-end">
            <Icon type="ArrowUp" size="$xl" />
          </XStack>
        </YStack>
        <Button onPress={handleNext} hero shadow>
          <Button.Text>Next</Button.Text>
        </Button>
      </YStack>
    </View>
  );
};
