import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_ONBOARDING_PHONE_NUMBER,
  DEFAULT_TLON_LOGIN_EMAIL,
  DEFAULT_TLON_LOGIN_PASSWORD,
  EMAIL_REGEX,
} from '@tloncorp/app/constants';
import { HostingError } from '@tloncorp/app/lib/hostingApi';
import { createDevLogger } from '@tloncorp/shared';
import {
  Field,
  KeyboardAvoidingView,
  OnboardingTextBlock,
  PrimaryButton,
  ScreenHeader,
  TextInput,
  TlonText,
  View,
  YStack,
} from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { PhoneNumberInput } from '../../components/OnboardingInputs';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { useOnboardingContext } from '../../lib/OnboardingContext';
import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

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
    setOtpMethod((curr) => (curr === 'phone' ? 'email' : 'phone'));
  }, []);

  const handlePressEula = useCallback(() => {
    navigation.navigate('EULA');
  }, [navigation]);

  // dev helper: if password prefill set, skip this screen
  useEffect(() => {
    if (DEFAULT_TLON_LOGIN_PASSWORD) {
      navigation.navigate('TlonLoginLegacy');
    }
  }, [navigation]);

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
          navigation.navigate('CheckOTP', {
            mode: 'login',
            otpMethod: 'phone',
            phoneNumber,
          });
        })();
      } else {
        await emailForm.handleSubmit(async ({ email }) => {
          await hostingApi.requestLoginOtp({ email, recaptchaToken });
          navigation.navigate('CheckOTP', {
            mode: 'login',
            otpMethod: 'email',
            email,
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
                      onSubmitEditing={onSubmit}
                    />
                  </Field>
                )}
                name="email"
              />
            )}

            <PrimaryButton
              onPress={onSubmit}
              loading={isSubmitting}
              disabled={
                isSubmitting ||
                (otpMethod === 'phone'
                  ? !phoneForm.formState.isValid
                  : !emailForm.formState.isValid)
              }
            >
              <TlonText.Text color="$background" size="$label/l">
                Send code to log in
              </TlonText.Text>
            </PrimaryButton>

            <TlonText.Text
              textAlign="center"
              size="$label/s"
              color="$tertiaryText"
              marginTop="$m"
            >
              By logging in you agree to Tlon&rsquo;s{' '}
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
          <View>
            {otpMethod === 'email' ? (
              <>
                <TlonText.Text
                  color="$secondaryText"
                  marginTop="$xl"
                  textAlign="center"
                >
                  We&apos;ll email you a 6-digit code to log in. Otherwise, you
                  can{' '}
                  <TlonText.RawText
                    pressStyle={{
                      opacity: 0.5,
                    }}
                    textDecorationLine="underline"
                    textDecorationDistance={10}
                    onPress={() => navigation.navigate('TlonLoginLegacy')}
                  >
                    log in with a password
                  </TlonText.RawText>
                </TlonText.Text>
                <TlonText.Text
                  color="$secondaryText"
                  onPress={handlePressEmailSignup}
                  marginTop="$xl"
                  textDecorationLine="underline"
                  textDecorationDistance={10}
                  textAlign="center"
                >
                  Log in with phone number instead
                </TlonText.Text>
              </>
            ) : (
              <TlonText.Text
                size="$label/s"
                color="$secondaryText"
                textAlign="center"
                onPress={handlePressEmailSignup}
                marginTop="$xl"
                textDecorationLine="underline"
                textDecorationDistance={10}
              >
                Normally log in with email?
              </TlonText.Text>
            )}
          </View>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
