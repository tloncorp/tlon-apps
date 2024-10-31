import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_ONBOARDING_PHONE_NUMBER,
  DEFAULT_ONBOARDING_TLON_EMAIL,
  EMAIL_REGEX,
} from '@tloncorp/app/constants';
import {
  useLureMetadata,
  useSignupParams,
} from '@tloncorp/app/contexts/branch';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Field,
  KeyboardAvoidingView,
  OnboardingInviteBlock,
  ScreenHeader,
  TextInput,
  TlonText,
  View,
  YStack,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { PhoneNumberInput } from '../../components/OnboardingInputs';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { useOnboardingContext } from '../../lib/OnboardingContext';
import type { OnboardingStackParamList } from '../../types';
import { useSignupContext } from '.././../lib/signupContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpEmail'>;

type PhoneFormData = {
  phoneNumber: string;
};

type EmailFormData = {
  email: string;
};

function genDefaultEmail() {
  const entropy = String(Math.random()).slice(2, 12);
  return `${DEFAULT_ONBOARDING_TLON_EMAIL}+test.${entropy.slice(0, 4)}.${entropy.slice(4, 8)}@tlon.io`;
}

export const SignUpPhoneNumberScreen = ({ navigation }: Props) => {
  const [otpMethod, setOtpMethod] = useState<'phone' | 'email'>('phone');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const { hostingApi } = useOnboardingContext();

  const signupParams = useSignupParams();
  const signupContext = useSignupContext();
  const lureMeta = useLureMetadata();
  const recaptcha = useRecaptcha();

  const toggleSignupMode = useCallback(() => {
    setOtpMethod((curr) => (curr === 'phone' ? 'email' : 'phone'));
  }, []);

  const phoneForm = useForm<PhoneFormData>({
    defaultValues: {
      phoneNumber: DEFAULT_ONBOARDING_PHONE_NUMBER ?? '',
    },
  });

  const emailForm = useForm<EmailFormData>({
    defaultValues: {
      email: DEFAULT_ONBOARDING_TLON_EMAIL ? genDefaultEmail() : '',
    },
  });

  const onSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const { enabled } = await hostingApi.getHostingAvailability({
        lure: signupParams.lureId,
        priorityToken: signupParams.priorityToken,
      });
      if (!enabled) {
        navigation.navigate('JoinWaitList', {});
        return;
      }

      const recaptchaToken = await recaptcha.getToken();
      if (!recaptchaToken) {
        setRemoteError(
          `We're having trouble confirming you're human. (reCAPTCHA)`
        );
        return;
      }

      if (otpMethod === 'phone') {
        await phoneForm.handleSubmit(async ({ phoneNumber }) => {
          await hostingApi.requestSignupOtp({ phoneNumber, recaptchaToken });
        })();
      } else {
        await emailForm.handleSubmit(async ({ email }) => {
          await hostingApi.requestSignupOtp({ email, recaptchaToken });
        })();
      }

      trackOnboardingAction({
        actionName: 'Phone Number Submitted',
        phoneNumber: phoneForm.getValues().phoneNumber,
        email: emailForm.getValues().email,
        lure: signupParams.lureId,
      });

      signupContext.setOnboardingValues({
        phoneNumber: phoneForm.getValues().phoneNumber,
        email: emailForm.getValues().email,
      });

      navigation.navigate('CheckOTP', {
        mode: 'signup',
        otpMethod,
      });
    } catch (err) {
      console.error('Error verifiying phone number:', err);
      if (err instanceof SyntaxError) {
        setRemoteError('Invalid phone number, please contact support@tlon.io');
        trackError({ message: 'Invalid phone number' });
      } else if (err instanceof Error) {
        setRemoteError(err.message);
        trackError(err);
      }
    }

    setIsSubmitting(false);
  }, [
    recaptcha,
    hostingApi,
    phoneForm,
    emailForm,
    otpMethod,
    signupParams,
    signupContext,
    navigation,
  ]);

  const goBack = useCallback(() => {
    signupContext.clear();
    navigation.goBack();
  }, [navigation, signupContext]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Accept invite"
        showSessionStatus={false}
        backAction={goBack}
        isLoading={isSubmitting}
        rightControls={
          <ScreenHeader.TextButton onPress={onSubmit} disabled={isSubmitting}>
            Next
          </ScreenHeader.TextButton>
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={180}>
        <YStack gap="$2xl" paddingHorizontal="$2xl" paddingVertical="$l">
          {lureMeta ? <OnboardingInviteBlock metadata={lureMeta} /> : null}
          <YStack gap="$m" paddingTop="$m">
            {otpMethod === 'phone' ? (
              <PhoneNumberInput form={phoneForm} />
            ) : (
              <Controller
                control={emailForm.control}
                rules={{
                  required: 'Please enter a valid email address.',
                  pattern: {
                    value: EMAIL_REGEX,
                    message: 'Please enter a valid email address.',
                  },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Email"
                    error={emailForm.formState.errors.email?.message}
                  >
                    <TextInput
                      placeholder="Email Address"
                      onBlur={() => {
                        onBlur();
                        emailForm.trigger('email');
                      }}
                      onChangeText={onChange}
                      value={value}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      enablesReturnKeyAutomatically
                    />
                  </Field>
                )}
                name="email"
              />
            )}
          </YStack>
          <View marginLeft="$l">
            <TlonText.Text
              size="$label/s"
              color="$tertiaryText"
              onPress={toggleSignupMode}
            >
              Or if you&apos;d prefer,{' '}
              <TlonText.RawText
                pressStyle={{
                  opacity: 0.5,
                }}
                textDecorationLine="underline"
                textDecorationDistance={10}
                onPress={toggleSignupMode}
              >
                sign up with {otpMethod === 'phone' ? 'email' : 'phone number'}
              </TlonText.RawText>
            </TlonText.Text>
          </View>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
