import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HostingError } from '@tloncorp/api';
import {
  DEFAULT_ONBOARDING_PHONE_NUMBER,
  DEFAULT_TLON_LOGIN_EMAIL,
  DEFAULT_TLON_LOGIN_PASSWORD,
  EMAIL_REGEX,
} from '@tloncorp/app/constants';
import {
  Field,
  KeyboardAvoidingView,
  ScreenHeader,
  SplashParagraph,
  SplashTitle,
  TextInput,
  TlonText,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import { Button, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

import { PhoneNumberInput } from '../../components/OnboardingInputs';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { useOnboardingContext } from '../../lib/OnboardingContext';
import { selectRecaptchaPlatform } from '../../lib/hostingAuth';
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
  const insets = useSafeAreaInsets();
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
          try {
            await hostingApi.requestLoginOtp({
              phoneNumber,
              recaptchaToken,
              platform: selectRecaptchaPlatform(),
            });
          } catch (err) {
            if (err instanceof HostingError) {
              if (err.details.status === 429) {
                // Rate limited, must have received one recently so proceed
              }
              if (err.details.status === 404) {
                setRemoteError(
                  `There's no phone number associated with this account.`
                );
                return;
              }
            }
            setRemoteError('Something went wrong. Please try again.');
            return;
          }

          logger.trackEvent('Initiated login', { type: 'phone', phoneNumber });
          navigation.navigate('CheckOTP', {
            mode: 'login',
            otpMethod: 'phone',
            phoneNumber,
          });
        })();
      } else {
        await emailForm.handleSubmit(async ({ email }) => {
          try {
            await hostingApi.requestLoginOtp({
              email,
              recaptchaToken,
              platform: selectRecaptchaPlatform(),
            });
          } catch (err) {
            if (err instanceof HostingError) {
              if (err.details.status === 429) {
                // Rate limited, must have received one recently so proceed
              }
              if (err.details.status === 404) {
                setRemoteError(
                  'There is no account associated with this email.'
                );
                return;
              }
            }
            setRemoteError('Something went wrong. Please try again.');
            return;
          }
          logger.trackEvent('Initiated login', { type: 'email', email });
          navigation.navigate('CheckOTP', {
            mode: 'login',
            otpMethod: 'email',
            email,
          });
        })();
      }
    } catch (err) {
      if (err instanceof HostingError) {
        if (err.details.status === 404) {
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

  const isFormValid =
    otpMethod === 'phone'
      ? phoneForm.formState.isValid
      : emailForm.formState.isValid;

  return (
    <KeyboardAvoidingView keyboardVerticalOffset={0}>
      <View
        flex={1}
        backgroundColor="$background"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      >
        <View paddingHorizontal="$xl" paddingTop="$2xl">
          <ScreenHeader.BackButton onPress={goBack} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: getTokenValue('$2xl', 'size'),
            paddingBottom: getTokenValue('$4xl', 'size'),
            gap: getTokenValue('$2xl', 'size'),
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <SplashTitle>
            Welcome <Text color="$positiveActionText">back.</Text>
          </SplashTitle>
          <SplashParagraph marginBottom={0}>
            Enter the {otpMethod === 'phone' ? 'phone number' : 'email'}{' '}
            associated with your Tlon account.
          </SplashParagraph>
          <YStack paddingHorizontal="$xl" gap="$m">
            {remoteError ? (
              <TlonText.Text color="$negativeActionText" size="$label/m">
                {remoteError}
              </TlonText.Text>
            ) : null}
            {otpMethod === 'phone' ? (
              <PhoneNumberInput form={phoneForm} shouldFocus={false} />
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
                      testID="email-input"
                    />
                  </Field>
                )}
                name="email"
              />
            )}
            {otpMethod === 'email' ? (
              <YStack gap="$m" marginTop="$m" alignItems="center">
                <TlonText.Text size="$label/s" color="$secondaryText">
                  We&apos;ll email you a 6-digit code to log in.
                </TlonText.Text>
                <Pressable
                  testID="or-use-password"
                  onPress={() => navigation.navigate('TlonLoginLegacy')}
                >
                  <TlonText.Text
                    size="$label/s"
                    color="$secondaryText"
                    textDecorationLine="underline"
                    textDecorationDistance={10}
                  >
                    Or, log in with a password
                  </TlonText.Text>
                </Pressable>
                <TlonText.Text
                  size="$label/s"
                  color="$secondaryText"
                  textDecorationLine="underline"
                  textDecorationDistance={10}
                  onPress={handlePressEmailSignup}
                >
                  Log in with phone number instead
                </TlonText.Text>
              </YStack>
            ) : (
              <TlonText.Text
                size="$label/s"
                color="$secondaryText"
                textAlign="center"
                marginTop="$m"
                onPress={handlePressEmailSignup}
                textDecorationLine="underline"
                textDecorationDistance={10}
              >
                Normally log in with email?
              </TlonText.Text>
            )}
          </YStack>
        </ScrollView>
        <YStack paddingHorizontal="$xl" gap="$l" paddingTop="$xl">
          <TlonText.Text
            textAlign="center"
            size="$label/s"
            color="$tertiaryText"
          >
            By logging in you agree to Tlon&rsquo;s{' '}
            <TlonText.RawText
              pressStyle={{ opacity: 0.5 }}
              textDecorationLine="underline"
              textDecorationDistance={10}
              onPress={handlePressEula}
            >
              Terms of Service
            </TlonText.RawText>
          </TlonText.Text>
          <Button
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || !isFormValid}
            label={isSubmitting ? 'Sending…' : 'Send code to log in'}
            preset="hero"
            shadow={!isSubmitting && isFormValid}
          />
        </YStack>
      </View>
    </KeyboardAvoidingView>
  );
};
