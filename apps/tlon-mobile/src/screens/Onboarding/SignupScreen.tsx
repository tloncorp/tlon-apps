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
import { HostingError } from '@tloncorp/app/lib/hostingApi';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { createDevLogger } from '@tloncorp/shared';
import {
  Field,
  KeyboardAvoidingView,
  OnboardingInviteBlock,
  OnboardingTextBlock,
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
import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Signup'>;

type PhoneFormData = {
  phoneNumber: string;
};

type EmailFormData = {
  email: string;
};

const logger = createDevLogger('Signup', true);

function genDefaultEmail() {
  const entropy = String(Math.random()).slice(2, 12);
  return `${DEFAULT_ONBOARDING_TLON_EMAIL}+test.${entropy.slice(0, 4)}.${entropy.slice(4, 8)}@tlon.io`;
}

export const SignupScreen = ({ navigation }: Props) => {
  const [otpMethod, setOtpMethod] = useState<'phone' | 'email'>('phone');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const { hostingApi } = useOnboardingContext();

  const signupParams = useSignupParams();
  const signupContext = useSignupContext();
  const lureMeta = useLureMetadata();
  const recaptcha = useRecaptcha();

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

  const handleSuccess = useCallback(() => {
    trackOnboardingAction({
      actionName: 'Phone or Email Submitted',
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
  }, [
    phoneForm,
    emailForm,
    signupParams.lureId,
    signupContext,
    navigation,
    otpMethod,
  ]);

  const toggleSignupMode = useCallback(() => {
    setRemoteError(undefined);
    phoneForm.reset();
    emailForm.reset();
    setOtpMethod((curr) => (curr === 'phone' ? 'email' : 'phone'));
  }, [emailForm, phoneForm]);

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

      handleSuccess();
    } catch (err) {
      if (err instanceof HostingError) {
        if (err.code === 409) {
          setRemoteError(
            `This ${otpMethod === 'email' ? 'email' : 'phone number'} is ineligible for signup.`
          );
        }

        if (err.code === 429) {
          // hosting timed out on sending OTP's. This means they already received one, so
          // we should just move them along to the next screen
          handleSuccess();
        }
      } else {
        logger.trackError('Unexpected error during signup OTP request', {
          errorMessage: err.message,
          errorStack: err.stack,
          email: emailForm.getValues().email,
          phoneNumber: phoneForm.getValues().phoneNumber,
        });
        setRemoteError('Something went wrong. Please try again later.');
      }
    }

    setIsSubmitting(false);
  }, [
    hostingApi,
    signupParams.lureId,
    signupParams.priorityToken,
    recaptcha,
    otpMethod,
    handleSuccess,
    navigation,
    phoneForm,
    emailForm,
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
          {remoteError ? (
            <OnboardingTextBlock>
              <TlonText.Text color="$negativeActionText" fontSize="$s">
                {remoteError}
              </TlonText.Text>
            </OnboardingTextBlock>
          ) : null}
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
