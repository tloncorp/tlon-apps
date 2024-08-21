import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestNotificationToken } from '@tloncorp/app/lib/notifications';
import { trackError } from '@tloncorp/app/utils/posthog';
import {
  Button,
  GenericHeader,
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
    <View flex={1}>
      <GenericHeader
        title="Notifications"
        rightContent={
          <Button minimal onPress={() => goToNext()}>
            <Text fontSize={'$m'}>Skip</Text>
          </Button>
        }
      />
      <YStack gap="$3xl" padding="$2xl">
        <SizableText color="$primaryText" fontSize="$l">
          Enable notifications so you&rsquo;re alerted when you receive new
          messages.
        </SizableText>
        <PrimaryButton
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
      </YStack>
    </View>
  );
};
