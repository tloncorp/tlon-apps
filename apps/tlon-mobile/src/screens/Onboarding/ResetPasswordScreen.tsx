import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EMAIL_REGEX } from '@tloncorp/app/constants';
import { requestPasswordReset } from '@tloncorp/app/lib/hostingApi';
import { trackError } from '@tloncorp/app/utils/posthog';
import {
  Button,
  Field,
  GenericHeader,
  KeyboardAvoidingView,
  SizableText,
  Text,
  TextInput,
  View,
  YStack,
} from '@tloncorp/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ResetPassword'>;

type FormData = {
  email: string;
};

export const ResetPasswordScreen = ({
  navigation,
  route: {
    params: { email: emailParam },
  },
}: Props) => {
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
        trackError(err);
      }
    }

    setIsSubmitting(false);
  });

  return (
    <View flex={1}>
      <GenericHeader
        title="Reset Password"
        showSessionStatus={false}
        goBack={() => navigation.goBack()}
        showSpinner={isSubmitting}
        rightContent={
          isValid && (
            <Button minimal onPress={onSubmit}>
              <Text fontSize={'$m'}>Submit</Text>
            </Button>
          )
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={90}>
        <YStack gap="$2xl" padding="$2xl">
          <SizableText size="$l">
            Enter the email associated with your Tlon account. We&rsquo;ll send
            you a link to reset your password.
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
                  returnKeyType="send"
                  enablesReturnKeyAutomatically
                />
              </Field>
            )}
          />
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
