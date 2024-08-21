import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addUserToWaitlist } from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  GenericHeader,
  PrimaryButton,
  SizableText,
  View,
  YStack,
} from '@tloncorp/ui';
import { useState } from 'react';

import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinWaitList'>;

export const JoinWaitListScreen = ({
  navigation,
  route: {
    params: { email, lure },
  },
}: Props) => {
  const [remoteError, setRemoteError] = useState<string | undefined>();

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
    <View flex={1}>
      <GenericHeader title="Join Waitlist" goBack={() => navigation.goBack()} />
      <YStack padding="$xl" gap="$2xl">
        <SizableText color="$primaryText" textAlign="center">
          We&rsquo;ve given out all available accounts for today, but w&rsquo;ll
          have more soon. If you&rsquo;d like, we can let you know when
          they&rsquo;re ready.
        </SizableText>
        {remoteError ? (
          <SizableText fontSize="$s" color="$negativeActionText">
            {remoteError}
          </SizableText>
        ) : null}
        <View>
          <PrimaryButton onPress={handleSubmit} alignSelf="center">
            Notify Me
          </PrimaryButton>
        </View>
      </YStack>
    </View>
  );
};
