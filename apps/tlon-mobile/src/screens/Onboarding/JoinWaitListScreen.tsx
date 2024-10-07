import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EMAIL_REGEX } from '@tloncorp/app/constants';
import { addUserToWaitlist } from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Field,
  ScreenHeader,
  TextInput,
  TlonText,
  View,
  YStack,
} from '@tloncorp/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';

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
      Alert.alert('Success', 'You have been added to the waitlist.', [
        {
          text: 'OK',
          onPress: () => navigation.popToTop(),
        },
      ]);
    } catch (err) {
      console.error('Error joining waitlist:', err);
      Alert.alert('Failed', 'Unable to add you to the waitlist.');
      if (err instanceof Error) {
        setRemoteError(err.message);
        trackError(err);
      }
    }
  };

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Join Waitlist"
        showSessionStatus={false}
        backAction={() => navigation.goBack()}
        rightControls={
          <ScreenHeader.TextButton
            disabled={!isValid}
            onPress={handleSubmit(onSubmit)}
          >
            Submit
          </ScreenHeader.TextButton>
        }
      />
      <YStack paddingHorizontal="$2xl" gap="$m">
        <View padding="$xl">
          <TlonText.Text size="$body" color="$primaryText">
            We&rsquo;ll let you know as soon as space is available.
          </TlonText.Text>
        </View>
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
            <Field label="Email" error={errors.email?.message} paddingTop="$m">
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
          <TlonText.Text fontSize="$s" color="$negativeActionText">
            {remoteError}
          </TlonText.Text>
        ) : null}
      </YStack>
    </View>
  );
};
