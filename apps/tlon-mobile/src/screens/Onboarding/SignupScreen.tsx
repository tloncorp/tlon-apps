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
} from '@tloncorp/app/ui';
import { Button } from '@tloncorp/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import { HostingError } from '@tloncorp/shared/api';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform } from 'react-native';

import { PhoneNumberInput } from '../../components/OnboardingInputs';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { useOnboardingContext } from '../../lib/OnboardingContext';
import { selectRecaptchaPlatform } from '../../lib/hostingAuth';
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

  const handlePressEula = useCallback(() => {
    navigation.navigate('EULA');
  }, [navigation]);

  const handleSuccess = useCallback(() => {
    trackOnboardingAction({
      actionName: 'Phone or Email Submitted',
      phoneNumber: phoneForm.getValues().phoneNumber,
      email: emailForm.getValues().email,
      lure: lureMeta?.id,
    });

    signupContext.setOnboardingValues({
      phoneNumber: phoneForm.getValues().phoneNumber,
      email: emailForm.getValues().email,
    });

    navigation.navigate('CheckOTP', {
      mode: 'signup',
      otpMethod,
    });
  }, [phoneForm, emailForm, lureMeta, signupContext, navigation, otpMethod]);

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
        priorityToken: signupParams.priorityToken,
        lure: lureMeta?.id,
      });
      if (!enabled) {
        logger.trackError(AnalyticsEvent.InvitedUserFailedInventoryCheck, {
          severity: AnalyticsSeverity.Critical,
        });
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
          await hostingApi.requestSignupOtp({
            phoneNumber,
            recaptchaToken,
            platform: selectRecaptchaPlatform(),
          });
        })();
      } else {
        await emailForm.handleSubmit(async ({ email }) => {
          await hostingApi.requestSignupOtp({
            email,
            recaptchaToken,
            platform: selectRecaptchaPlatform(),
          });
        })();
      }

      handleSuccess();
    } catch (err) {
      setRemoteError(`Something bad happened. Err: ${err.toString()}`);
      if (err instanceof HostingError) {
        if (err.details.status === 409) {
          setRemoteError(
            `An account with this ${otpMethod === 'email' ? 'email' : 'phone number'} already exists.`
          );
        }

        if (err.details.status === 429) {
          // hosting timed out on sending OTP's. This means they already received one, so
          // we should just move them along to the next screen
          handleSuccess();
        }
      } else {
        logger.trackError('Unexpected error during signup OTP request', {
          error: err,
          email: emailForm.getValues().email,
          phoneNumber: phoneForm.getValues().phoneNumber,
        });
        setRemoteError('Something went wrong. Please try again later.');
      }
    }

    setIsSubmitting(false);
  }, [
    hostingApi,
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
                      returnKeyType={
                        emailForm.formState.isValid ? 'next' : 'default'
                      }
                      enablesReturnKeyAutomatically={
                        emailForm.formState.isValid
                      }
                      onSubmitEditing={
                        emailForm.formState.isValid ? onSubmit : undefined
                      }
                      autoFocus
                    />
                  </Field>
                )}
                name="email"
              />
            )}

            <Button
              onPress={onSubmit}
              loading={isSubmitting}
              disabled={
                isSubmitting ||
                (otpMethod === 'phone'
                  ? !phoneForm.formState.isValid
                  : !emailForm.formState.isValid)
              }
              label="Sign up"
              centered
            />
            <TlonText.Text
              marginTop="$m"
              textAlign="center"
              size="$label/s"
              color="$tertiaryText"
            >
              By signing up you agree to Tlon&rsquo;s{' '}
              <TlonText.RawText
                pressStyle={{
                  opacity: 0.5,
                }}
                textDecorationLine="underline"
                textDecorationDistance={10}
                onPress={handlePressEula}
              >
                Terms of Service
              </TlonText.RawText>
            </TlonText.Text>
          </YStack>
          <View marginLeft="$l" marginTop="$m">
            <TlonText.Text
              size="$label/s"
              color="$tertiaryText"
              onPress={toggleSignupMode}
              textAlign="center"
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
                sign up with{' '}
                {otpMethod === 'phone' ? 'an email address' : 'a phone number'}
              </TlonText.RawText>
            </TlonText.Text>
          </View>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
