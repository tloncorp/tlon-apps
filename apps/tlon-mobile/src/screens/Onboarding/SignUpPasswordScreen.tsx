import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RECAPTCHA_SITE_KEY } from '@tloncorp/app/constants';
import { useSignupParams } from '@tloncorp/app/contexts/branch';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import { setEulaAgreed } from '@tloncorp/app/utils/eula';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { createDevLogger } from '@tloncorp/shared';
import {
  Button,
  Field,
  KeyboardAvoidingView,
  ListItem,
  Modal,
  ScreenHeader,
  TextInput,
  TlonText,
  View,
  YStack,
} from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useWindowDimensions } from 'react-native';
import { getTokenValue } from 'tamagui';

import { useOnboardingContext } from '../../lib/OnboardingContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpPassword'>;

type FormData = {
  password: string;
  confirmPassword: string;
  eulaAgreed: boolean;
};

const logger = createDevLogger('SignUpPassword', true);

export const SignUpPasswordScreen = ({
  navigation,
  route: {
    params: { email },
  },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recaptchaError, setRecaptchaError] = useState<Error | null>(null);
  const [recaptchaReInitError, setRecaptchaReInitError] =
    useState<Error | null>(null);
  const signupContext = useSignupContext();
  const signupParams = useSignupParams();
  const { initRecaptcha, execRecaptchaLogin, hostingApi } =
    useOnboardingContext();
  const {
    control,
    setFocus,
    handleSubmit,
    formState: { errors, isValid },
    setError,
  } = useForm<FormData>({
    defaultValues: {
      eulaAgreed: false,
    },
    mode: 'onBlur',
  });
  const { height } = useWindowDimensions();

  const handlePressEula = useCallback(() => {
    navigation.navigate('EULA');
  }, [navigation]);

  const onSubmit = handleSubmit(async (params) => {
    const { password } = params;
    setIsSubmitting(true);

    let recaptchaToken: string | undefined;
    try {
      recaptchaToken = await execRecaptchaLogin();
    } catch (err) {
      console.error('Error executing reCAPTCHA:', err);
      if (err instanceof Error) {
        setRecaptchaError(err);
        logger.trackError('Error executing reCAPTCHA', {
          thrownErrorMessage: err.message,
        });
      }
    }

    await setEulaAgreed();

    if (!recaptchaToken || recaptchaError || recaptchaReInitError) {
      setIsSubmitting(false);
      return;
    }

    try {
      await hostingApi.signUpHostingUser({
        email,
        password,
        recaptchaToken,
        lure: signupParams.lureId,
        priorityToken: signupParams.priorityToken,
      });
      signupContext.setDidSignup(true);
    } catch (err) {
      console.error('Error signing up user:', err);
      if (err instanceof Error) {
        setError('password', {
          type: 'custom',
          message: err.message,
        });
        logger.trackError('Error signing up user', {
          thrownErrorMessage: err.message,
        });
      }
      setIsSubmitting(false);
      return;
    }

    trackOnboardingAction({
      actionName: 'Account Created',
      email,
      lure: signupParams.lureId,
    });

    try {
      const user = await hostingApi.logInHostingUser({
        email,
        password,
      });
      if (user.requirePhoneNumberVerification) {
        navigation.navigate('RequestPhoneVerify', { user });
      } else {
        navigation.navigate('CheckVerify', { user });
      }
    } catch (err) {
      console.error('Error logging in user:', err);
      if (err instanceof Error) {
        setError('password', {
          type: 'custom',
          message: err.message,
        });
        logger.trackError('Error logging in user', {
          thrownErrorMessage: err.message,
        });
      }
    }

    setIsSubmitting(false);
  });

  // Initialize reCAPTCHA client
  useEffect(() => {
    (async () => {
      try {
        await initRecaptcha(RECAPTCHA_SITE_KEY, 10_000);
      } catch (err) {
        console.error('Error initializing reCAPTCHA client:', err);
        if (err instanceof Error) {
          setRecaptchaError(err);
          logger.trackError('Error initializing reCAPTCHA client', {
            thrownErrorMessage: err.message,
            siteKey: RECAPTCHA_SITE_KEY,
          });
        }
      }
    })();
  }, []);

  // Re-initialize reCAPTCHA client if an error occurred
  useEffect(() => {
    if (recaptchaError && !recaptchaReInitError) {
      (async () => {
        try {
          await initRecaptcha(RECAPTCHA_SITE_KEY, 10_000);
          setRecaptchaError(null);
          await onSubmit();
        } catch (err) {
          console.error('Error re-initializing reCAPTCHA client:', err);
          if (err instanceof Error) {
            logger.trackError('Error re-initializing reCAPTCHA client', {
              thrownErrorMessage: err.message,
              siteKey: RECAPTCHA_SITE_KEY,
            });
            setRecaptchaReInitError(err);
          }
        }
      })();
    }
  }, [recaptchaError]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Create account"
        showSessionStatus={false}
        backAction={() => navigation.goBack()}
        isLoading={isSubmitting}
        rightControls={
          <ScreenHeader.TextButton disabled={!isValid} onPress={onSubmit}>
            Next
          </ScreenHeader.TextButton>
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={90}>
        <YStack gap="$m" paddingHorizontal="$2xl" paddingVertical="$l">
          {/* {lureMeta ? <AppInviteDisplay metadata={lureMeta} /> : null} */}
          <View padding="$xl">
            <TlonText.Text size="$body" color="$primaryText">
              Please set a strong password with at least 8 characters.
            </TlonText.Text>
          </View>
          <YStack gap="$2xl">
            <Controller
              control={control}
              name="password"
              rules={{
                required: 'Password must be at least 8 characters.',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters.',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label="Password"
                  error={errors.password?.message}
                  paddingTop="$m"
                >
                  <TextInput
                    placeholder="Choose a password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    onSubmitEditing={() => setFocus('confirmPassword')}
                    value={value}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    enablesReturnKeyAutomatically
                  />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: 'Enter the password again for confirmation.',
                validate: (value, { password }) =>
                  value === password || 'Passwords must match.',
              }}
              render={({ field: { onChange, onBlur, value, ref } }) => (
                <Field
                  paddingTop="$m"
                  label="Confirm Password"
                  error={errors.confirmPassword?.message}
                >
                  <TextInput
                    placeholder="Confirm password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    onSubmitEditing={onSubmit}
                    value={value}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    ref={ref}
                    enablesReturnKeyAutomatically
                  />
                </Field>
              )}
            />
          </YStack>
          <View padding="$xl">
            <TlonText.Text size="$label/s" color="$tertiaryText">
              By registering you agree to Tlon&rsquo;s{' '}
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
          </View>
        </YStack>
      </KeyboardAvoidingView>
      <Modal visible={recaptchaReInitError !== null}>
        <ListItem padding="$2xl" top={height / 3} left={getTokenValue('$s')}>
          <YStack gap="$2xl">
            <TlonText.Text size="$body">
              We encountered an error reaching Google's reCAPTCHA service.
            </TlonText.Text>
            <TlonText.Text size="$body">
              This may be due to a network issue or a problem with the service
              itself.
            </TlonText.Text>
            <TlonText.Text size="$body">
              A retry may resolve the issue. If the problem persists, please
              contact support.
            </TlonText.Text>
            <Button onPress={() => setRecaptchaReInitError(null)}>
              <Button.Text>Retry</Button.Text>
            </Button>
          </YStack>
        </ListItem>
      </Modal>
    </View>
  );
};
