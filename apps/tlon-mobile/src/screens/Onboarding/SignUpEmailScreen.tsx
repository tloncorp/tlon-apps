import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EMAIL_REGEX } from '@tloncorp/app/constants';
import {
  useLureMetadata,
  useSignupParams,
} from '@tloncorp/app/contexts/branch';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  AppInviteDisplay,
  Field,
  KeyboardAvoidingView,
  ScreenHeader,
  TextInput,
  View,
  YStack,
} from '@tloncorp/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useOnboardingContext } from '../../lib/OnboardingContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpEmail'>;

type FormData = {
  email: string;
};

export const SignUpEmailScreen = ({ navigation, route: { params } }: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hostingApi } = useOnboardingContext();

  const signupParams = useSignupParams();
  const lureMeta = useLureMetadata();

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
      const { enabled, validEmail } = await hostingApi.getHostingAvailability({
        email,
        lure: signupParams.lureId,
        priorityToken: signupParams.priorityToken,
      });

      if (!enabled) {
        navigation.navigate('JoinWaitList', { email });
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
          lure: signupParams.lureId,
        });
        navigation.navigate('SignUpPassword', {
          email,
        });
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
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Accept invite"
        showSessionStatus={false}
        backAction={() => navigation.goBack()}
        isLoading={isSubmitting}
        rightControls={
          <ScreenHeader.TextButton disabled={!isValid} onPress={onSubmit}>
            Next
          </ScreenHeader.TextButton>
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={180}>
        <YStack gap="$2xl" paddingHorizontal="$2xl" paddingVertical="$l">
          {lureMeta ? <AppInviteDisplay metadata={lureMeta} /> : null}
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
              <Field
                label="Enter your email to claim"
                error={errors.email?.message}
              >
                <TextInput
                  placeholder="sampel@pal.net"
                  onBlur={() => {
                    onBlur();
                    trigger('email');
                  }}
                  backgroundColor={'$background'}
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
