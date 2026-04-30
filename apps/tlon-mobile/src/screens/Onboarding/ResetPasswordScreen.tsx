import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset } from '@tloncorp/api';
import { EMAIL_REGEX } from '@tloncorp/app/constants';
import {
  Field,
  KeyboardAvoidingView,
  ScreenHeader,
  SplashParagraph,
  SplashTitle,
  TextInput,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import { Button, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ResetPassword'>;

type FormData = {
  email: string;
};

const logger = createDevLogger('ResetPasswordScreen', true);

export const ResetPasswordScreen = ({
  navigation,
  route: {
    params: { email: emailParam },
  },
}: Props) => {
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setError,
    trigger,
  } = useForm<FormData>({
    defaultValues: {
      email: emailParam,
    },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      navigation.goBack();
    } catch (err) {
      console.error('Error resetting password:', err);
      if (err instanceof Error) {
        setError('email', {
          type: 'custom',
          message: err.message,
        });
        logger.trackError('Error resetting password', err);
      }
    }

    setIsSubmitting(false);
  });

  return (
    <KeyboardAvoidingView keyboardVerticalOffset={0}>
      <View
        flex={1}
        backgroundColor="$background"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      >
        <YStack flex={1} gap="$2xl" paddingTop="$2xl">
          <View paddingHorizontal="$xl">
            <ScreenHeader.BackButton
              onPress={isSubmitting ? undefined : () => navigation.goBack()}
            />
          </View>
          <SplashTitle>
            Reset your <Text color="$positiveActionText">password.</Text>
          </SplashTitle>
          <SplashParagraph marginBottom={0}>
            Enter the email associated with your Tlon account. We&rsquo;ll send
            you a link to reset your password.
          </SplashParagraph>
          <YStack paddingHorizontal="$xl" gap="$m">
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
                <Field error={errors.email?.message}>
                  <TextInput
                    placeholder="Email Address"
                    onBlur={() => {
                      onBlur();
                      trigger('email');
                    }}
                    onChangeText={onChange}
                    onSubmitEditing={onSubmit}
                    value={value}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="send"
                    enablesReturnKeyAutomatically
                    frameStyle={{
                      height: 72,
                      borderWidth: 0,
                      paddingLeft: 0,
                      paddingRight: 0,
                    }}
                    style={{ fontSize: 24, fontWeight: '600' }}
                  />
                </Field>
              )}
            />
          </YStack>
        </YStack>
        <Button
          onPress={onSubmit}
          label={isSubmitting ? 'Sending…' : 'Submit'}
          preset="hero"
          loading={isSubmitting}
          disabled={!isValid || isSubmitting}
          shadow={isValid && !isSubmitting}
          marginHorizontal="$xl"
          marginTop="$xl"
        />
      </View>
    </KeyboardAvoidingView>
  );
};
