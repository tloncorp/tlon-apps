import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EMAIL_REGEX } from '@tloncorp/app/constants';
import { addUserToWaitlist } from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Field,
  PrimaryButton,
  ScreenHeader,
  SizableText,
  TextInput,
  View,
  YStack,
} from '@tloncorp/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinWaitList'>;

type FormData = {
  email: string;
};

export const JoinWaitListScreen = ({ navigation }: Props) => {
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      await addUserToWaitlist({ email: data.email });
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
      <ScreenHeader
        title="Join Waitlist"
        showSessionStatus={false}
        backAction={() => navigation.goBack()}
      />
      <YStack padding="$xl" gap="$2xl">
        <SizableText color="$primaryText">
          We&rsquo;ve given out all available accounts for today, but
          we&rsquo;ll have more soon. If you&rsquo;d like, we can let you know
          via email when they&rsquo;re ready.
        </SizableText>
        <Controller
          control={control}
          name="email"
          rules={{
            required: 'Please enter a valid email address.',
            pattern: {
              value: EMAIL_REGEX,
              message: 'Please enter a valid email address.',
            },
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Field label="Email" error={errors.email?.message}>
              <TextInput
                placeholder="sampel@pal.net"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
          )}
        />
        {remoteError ? (
          <SizableText fontSize="$s" color="$negativeActionText">
            {remoteError}
          </SizableText>
        ) : null}
        <View>
          {isValid && (
            <PrimaryButton onPress={handleSubmit(onSubmit)} alignSelf="center">
              Notify Me
            </PrimaryButton>
          )}
        </View>
      </YStack>
    </View>
  );
};
