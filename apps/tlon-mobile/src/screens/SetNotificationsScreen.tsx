import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestNotificationToken } from '@tloncorp/app/lib/notifications';
import { trackError } from '@tloncorp/app/utils/posthog';
import { Text, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { TlonButton } from '../components/TlonButton';
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
  const tailwind = useTailwind();

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
    <View style={tailwind('p-6 h-full bg-white dark:bg-black')}>
      <Text
        style={tailwind(
          'text-lg font-medium text-tlon-black-80 dark:text-white'
        )}
      >
        Enable notifications so you're alerted when you receive new messages.
      </Text>
      <View style={tailwind('mt-12 mb-2')}>
        <TlonButton
          title="Enable"
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
          align="center"
          roundedFull
        />
      </View>
      <TlonButton
        title="Skip"
        variant="minimal"
        align="center"
        onPress={() => goToNext()}
        roundedFull
      />
    </View>
  );
};
