import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RECAPTCHA_SITE_KEY } from '@tloncorp/app/constants';
import {
  useLureMetadata,
  useSignupParams,
} from '@tloncorp/app/contexts/branch';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import { setEulaAgreed } from '@tloncorp/app/utils/eula';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  AppInviteDisplay,
  Field,
  KeyboardAvoidingView,
  ScreenHeader,
  TextInput,
  TextV2,
  View,
  YStack,
} from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useOnboardingContext } from '../../lib/OnboardingContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpPassword'>;

type FormData = {
  password: string;
  confirmPassword: string;
  eulaAgreed: boolean;
};

export const SignUpPasswordScreen = ({
  navigation,
  route: {
    params: { email },
  },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signupContext = useSignupContext();
  const signupParams = useSignupParams();
  const lureMeta = useLureMetadata();
  const { initRecaptcha, execRecaptchaLogin, hostingApi } =
    useOnboardingContext();
  const {
    control,
    setFocus,
    handleSubmit,
    formState: { errors, isValid },
    setError,
    trigger,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      eulaAgreed: false,
    },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (params) => {
    const { password } = params;
    setIsSubmitting(true);

    let recaptchaToken: string | undefined;
    try {
      recaptchaToken = await execRecaptchaLogin();
    } catch (err) {
      console.error('Error executing reCAPTCHA:', err);
      if (err instanceof Error) {
        setError('password', {
          type: 'custom',
          message: err.message,
        });
        trackError(err);
      }
    }

    if (params.eulaAgreed) {
      await setEulaAgreed();
    }

    if (!recaptchaToken) {
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
        trackError(err);
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
        trackError(err);
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
          setError('password', {
            type: 'custom',
            message: err.message,
          });
          trackError(err);
        }
      }
    })();
  }, []);

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
            <TextV2.Text size="$body" color="$primaryText">
              Please set a strong password with at least 8 characters.
            </TextV2.Text>
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
          <TextV2.Text padding="$xl" size="$label/s" color="$tertiaryText">
            By registering you agree to Tlon&rsquo;s{' '}
            <TextV2.RawText
              textDecorationLine="underline"
              textDecorationDistance={10}
            >
              Terms of Service
            </TextV2.RawText>
          </TextV2.Text>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
