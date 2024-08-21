import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestNotificationToken } from '@tloncorp/app/lib/notifications';
import { trackError } from '@tloncorp/app/utils/posthog';
import {
  Button,
  PrimaryButton,
  SizableText,
  Text,
  View,
  YStack,
} from '@tloncorp/ui';

import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'SetNotifications'
>;

export const SetNotificationsScreen = ({
  navigation,
  route: {
    params: { user, signUpExtras },
  },
}: Props) => {
  const goToNext = (notificationToken?: string) => {
    navigation.navigate('SetTelemetry', {
      user,
      signUpExtras: {
        ...signUpExtras,
        notificationToken,
      },
    });
  };

  return (
    <View flex={1} padding="$2xl" backgroundColor="$background">
      <YStack gap="$xl">
        <SizableText color="$primaryText" fontSize="$l">
          Enable notifications so you&rsquo;re alerted when you receive new
          messages.
        </SizableText>

        <PrimaryButton
          shadow
          onPress={async () => {
            let token: string | undefined;
            try {
              token = await requestNotificationToken();
            } catch (err) {
              console.error('Error enabling notifications:', err);
              if (err instanceof Error) {
                trackError(err);
              }
            }

            goToNext(token);
          }}
        >
          Enable
        </PrimaryButton>
        <Button minimal onPress={() => goToNext()}>
          <Text>Skip</Text>
        </Button>
      </YStack>
    </View>
  );
};
