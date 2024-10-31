import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_ONBOARDING_PHONE_NUMBER,
  DEFAULT_TLON_LOGIN_EMAIL,
  EMAIL_REGEX,
} from '@tloncorp/app/constants';
import {
  useLureMetadata,
  useSignupParams,
} from '@tloncorp/app/contexts/branch';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Button,
  Field,
  KeyboardAvoidingView,
  OnboardingButton,
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
import type { OnboardingStackParamList } from '../../types';
import { useSignupContext } from '.././../lib/signupContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpEmail'>;

type PhoneFormData = {
  phoneNumber: string;
};

type EmailFormData = {
  email: string;
};

export const TlonLoginPhoneNumberScreen = ({ navigation }: Props) => {
  const [otpMethod, setOtpMethod] = useState<'phone' | 'email'>('phone');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const { hostingApi } = useOnboardingContext();

  const signupContext = useSignupContext();
  const recaptcha = useRecaptcha();

  const handlePressEmailSignup = useCallback(() => {
    // navigation.navigate('SignUpEmail');
    setOtpMethod((curr) => (curr === 'phone' ? 'email' : 'phone'));
  }, []);

  const phoneForm = useForm<PhoneFormData>({
    defaultValues: {
      phoneNumber: DEFAULT_ONBOARDING_PHONE_NUMBER ?? '',
    },
  });

  const emailForm = useForm<EmailFormData>({
    defaultValues: {
      email: DEFAULT_TLON_LOGIN_EMAIL ?? '',
    },
  });

  // const onSubmitEmail = emailForm.handleSubmit(async ({ email }) => {
  //   setIsSubmitting(true);
  //   try {
  //     const recaptchaToken = await recaptcha.getToken();
  //     if (!recaptchaToken) {
  //       setRemoteError(
  //         `We're having trouble confirming you're human. (reCAPTCHA)`
  //       );
  //       return;
  //     }

  //     await hostingApi.requestLoginOtp({ email, recaptchaToken });

  // const onSubmitPhone = phoneForm.handleSubmit(async ({ phoneNumber }) => {
  //   setIsSubmitting(true);
  //   try {
  //     const recaptchaToken = await recaptcha.getToken();
  //     if (!recaptchaToken) {
  //       setRemoteError(
  //         `We're having trouble confirming you're human. (reCAPTCHA)`
  //       );
  //       return;
  //     }

  //     await hostingApi.requestLoginOtp({ phoneNumber, recaptchaToken });
  //     // navigation.navigate('CheckOTP', { mode: 'login', otpMethod: 'phone' });

  //     // await hostingApi.requestPhoneSignupOtp({ phoneNumber, recaptchaToken });
  //     // trackOnboardingAction({
  //     //   actionName: 'Phone Number Submitted',
  //     //   phoneNumber,
  //     //   lure: signupParams.lureId,
  //     // });
  //     // navigation.navigate('CheckOTP', { mode: 'signup', otpMethod: 'phone' });
  //   } catch (err) {
  //     console.error('Error verifiying phone number:', err);
  //     if (err instanceof SyntaxError) {
  //       setRemoteError('Invalid phone number, please contact support@tlon.io');
  //       trackError({ message: 'Invalid phone number' });
  //     } else if (err instanceof Error) {
  //       setRemoteError(err.message);
  //       trackError(err);
  //     }
  //   }

  //   setIsSubmitting(false);
  // });

  const onSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const recaptchaToken = await recaptcha.getToken();
      if (!recaptchaToken) {
        setRemoteError(
          `We're having trouble confirming you're human. (reCAPTCHA)`
        );
        return;
      }

      if (otpMethod === 'phone') {
        await phoneForm.handleSubmit(async ({ phoneNumber }) => {
          await hostingApi.requestLoginOtp({ phoneNumber, recaptchaToken });
        })();
        navigation.navigate('CheckOTP', {
          mode: 'login',
          otpMethod: 'phone',
          phoneNumber: phoneForm.getValues().phoneNumber,
        });
      } else {
        await emailForm.handleSubmit(async ({ email }) => {
          await hostingApi.requestLoginOtp({ email, recaptchaToken });
          navigation.navigate('CheckOTP', {
            mode: 'login',
            otpMethod: 'email',
            phoneNumber: emailForm.getValues().email,
          });
        })();
      }
    } catch (err) {
      console.error('Error verifiying phone number:', err);
      if (err instanceof SyntaxError) {
        setRemoteError('Invalid phone number, please contact support@tlon.io');
        trackError({ message: 'Invalid phone number' });
      } else if (err instanceof Error) {
        setRemoteError(err.message);
        trackError(err);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [emailForm, hostingApi, otpMethod, navigation, phoneForm, recaptcha]);

  const goBack = useCallback(() => {
    signupContext.clear();
    navigation.goBack();
  }, [navigation, signupContext]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Tlon Login"
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
          <OnboardingTextBlock>
            <TlonText.Text size="$body" color="$primaryText">
              Enter the phone number associated with your Tlon account.
            </TlonText.Text>
            <TlonText.Text size="$body" color="$negativeActionText">
              {remoteError}
            </TlonText.Text>
          </OnboardingTextBlock>
          <YStack display="flex" gap="$m">
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
                      // onSubmitEditing={() => setFocus('password')}
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
              color="$tertiaryText"
              onPress={handlePressEmailSignup}
            >
              {otpMethod === 'phone'
                ? 'Normally log in with email?'
                : 'Use phone number instead'}
            </TlonText.Text>
          </View>

          <OnboardingButton
            secondary
            onPress={() => {
              navigation.navigate('TlonLogin');
            }}
          >
            <Button.Text>Login with email/password</Button.Text>
          </OnboardingButton>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
