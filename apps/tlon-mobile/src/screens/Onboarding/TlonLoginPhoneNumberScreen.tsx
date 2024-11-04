import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_ONBOARDING_PHONE_NUMBER,
  DEFAULT_TLON_LOGIN_EMAIL,
  EMAIL_REGEX,
} from '@tloncorp/app/constants';
import { HostingError } from '@tloncorp/app/lib/hostingApi';
import { createDevLogger } from '@tloncorp/shared';
import {
  Field,
  KeyboardAvoidingView,
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

const logger = createDevLogger('TlonLoginScreen', true);

type Props = NativeStackScreenProps<OnboardingStackParamList, 'TlonLogin'>;

type PhoneFormData = {
  phoneNumber: string;
};

type EmailFormData = {
  email: string;
};

export const TlonLoginScreen = ({ navigation, route }: Props) => {
  const [otpMethod, setOtpMethod] = useState<'phone' | 'email'>(
    route.params?.initialLoginMethod ?? 'phone'
  );
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
      if (err instanceof HostingError) {
        if (err.code === 404) {
          setRemoteError(
            `Cannot log in. Are you sure you signed up with this ${otpMethod === 'phone' ? 'phone number' : 'email'}?`
          );
          return;
        }
      } else {
        logger.trackError('Error initializing Tlon login', err);
      }
      setRemoteError('Something went wrong. Please try again.');
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
              Enter the {otpMethod === 'phone' ? 'phone number' : 'email'}{' '}
              associated with your Tlon account.
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
            {otpMethod === 'email' ? (
              <>
                <TlonText.Text color="$tertiaryText" marginTop="$xl">
                  We&apos;ll email you a code to log in. Or you can{' '}
                  <TlonText.RawText
                    pressStyle={{
                      opacity: 0.5,
                    }}
                    textDecorationLine="underline"
                    textDecorationDistance={10}
                    onPress={() => navigation.navigate('TlonLoginLegacy')}
                  >
                    log in with a password.
                  </TlonText.RawText>
                </TlonText.Text>
                <TlonText.Text
                  color="$tertiaryText"
                  onPress={handlePressEmailSignup}
                  marginTop="$xl"
                  textDecorationLine="underline"
                  textDecorationDistance={10}
                >
                  Login with phone number instead
                </TlonText.Text>
              </>
            ) : (
              <TlonText.Text
                color="$tertiaryText"
                onPress={handlePressEmailSignup}
                marginTop="$xl"
                textDecorationLine="underline"
                textDecorationDistance={10}
              >
                Normally log in with email?
              </TlonText.Text>
            )}
          </View>

          {/* <OnboardingButton
            secondary
            onPress={() => {
              navigation.navigate('TlonLogin');
            }}
          >
            <Button.Text>Login with email/password</Button.Text>
          </OnboardingButton> */}
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
