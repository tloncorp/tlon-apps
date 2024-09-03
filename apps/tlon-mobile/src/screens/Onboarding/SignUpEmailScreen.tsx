import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_LURE,
  DEFAULT_PRIORITY_TOKEN,
  EMAIL_REGEX,
} from '@tloncorp/app/constants';
import { getHostingAvailability } from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Button,
  GenericHeader,
  Icon,
  KeyboardAvoidingView,
  SizableText,
  Text,
  TextInput,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { Field } from '@tloncorp/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpEmail'>;

type FormData = {
  email: string;
};

export const SignUpEmailScreen = ({
  navigation,
  route: {
    params: {
      lure = DEFAULT_LURE,
      priorityToken = DEFAULT_PRIORITY_TOKEN,
    } = {},
  },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setError,
    trigger,
  } = useForm<FormData>();

  const onSubmit = handleSubmit(async ({ email }) => {
    setIsSubmitting(true);

    try {
      const { enabled, validEmail } = await getHostingAvailability({
        email,
        lure,
        priorityToken,
      });

      if (!enabled) {
        navigation.navigate('JoinWaitList', { email, lure });
      } else if (!validEmail) {
        setError('email', {
          type: 'custom',
          message:
            'This email address is ineligible for signup. Please contact support@tlon.io.',
        });
        trackError({ message: 'Ineligible email address' });
      } else {
        trackOnboardingAction({
          actionName: 'Email submitted',
          email,
          lure,
        });
        navigation.navigate('SignUpPassword', { email, lure, priorityToken });
      }
    } catch (err) {
      console.error('Error getting hosting availability:', err);
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
        title="Sign Up"
        showSessionStatus={false}
        goBack={() => navigation.goBack()}
        showSpinner={isSubmitting}
        rightContent={
          isValid && (
            <Button minimal onPress={onSubmit}>
              <Text fontSize={'$m'}>Next</Text>
            </Button>
          )
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={180}>
        <YStack gap="$2xl" padding="$2xl">
          <SizableText>
            Enter your email address. You&rsquo;ll use it to log in to Tlon and
            we&rsquo;ll email you the occasional service update.
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
