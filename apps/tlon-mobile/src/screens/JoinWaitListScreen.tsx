import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addUserToWaitlist } from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { TlonButton } from '../components/TlonButton';
import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinWaitList'>;

export const JoinWaitListScreen = ({
  navigation,
  route: {
    params: { email, lure },
  },
}: Props) => {
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const tailwind = useTailwind();

  const handleSubmit = async () => {
    try {
      await addUserToWaitlist({ email, lure });
      trackOnboardingAction({
        actionName: 'Waitlist Joined',
      });
      navigation.popToTop();
    } catch (err) {
      console.error('Error joining waitlist:', err);
      if (err instanceof Error) {
        setRemoteError(err.message);
        trackError(err);
      }
    }
  };

  return (
    <View style={tailwind('p-6 h-full bg-white dark:bg-black')}>
      <Text
        style={tailwind(
          'text-lg font-medium text-tlon-black-80 dark:text-white'
        )}
      >
        We've given out all available slots for today, but we'll have more soon.
        If you'd like, we can let you know when they're ready.
      </Text>
      {remoteError ? (
        <Text style={tailwind('mt-4 text-tlon-red')}>{remoteError}</Text>
      ) : null}
      <View style={tailwind('mt-8')}>
        <TlonButton
          title="Notify Me"
          onPress={handleSubmit}
          align="center"
          roundedFull
        />
      </View>
    </View>
  );
};
