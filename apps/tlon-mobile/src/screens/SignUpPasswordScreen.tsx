import {
  RecaptchaAction,
  execute,
  initClient,
} from '@google-cloud/recaptcha-enterprise-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RECAPTCHA_SITE_KEY } from '@tloncorp/app/constants';
import {
  logInHostingUser,
  signUpHostingUser,
} from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Button,
  GenericHeader,
  Input,
  KeyboardAvoidingView,
  Text,
  View,
  YStack,
} from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpPassword'>;

type FormData = {
  password: string;
  confirmPassword: string;
};

export const SignUpPasswordScreen = ({
  navigation,
  route: {
    params: { email, lure, priorityToken },
  },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    setFocus,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormData>();

  const onSubmit = handleSubmit(async ({ password }) => {
    setIsSubmitting(true);

    let recaptchaToken: string | undefined;
    try {
      recaptchaToken = await execute(RecaptchaAction.LOGIN(), 10_000);
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

    if (!recaptchaToken) {
      setIsSubmitting(false);
      return;
    }

    try {
      await signUpHostingUser({
        email,
        password,
        recaptchaToken,
        lure,
        priorityToken,
      });
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
      lure,
    });

    try {
      const user = await logInHostingUser({
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
        await initClient(RECAPTCHA_SITE_KEY, 10_000);
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
    <View flex={1}>
      <GenericHeader
        title="Set Password"
        goBack={() => navigation.goBack()}
        showSpinner={isSubmitting}
        rightContent={
          <Button minimal onPress={onSubmit}>
            <Text fontSize="$m">Next</Text>
          </Button>
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={90}>
        <YStack gap="$xl" padding="$2xl">
          <Text color="$primaryText">Password</Text>

          <Controller
            control={control}
            rules={{
              required:
                'A password with a minimum of 8 characters is required.',
              minLength: {
                value: 8,
                message:
                  'A password with a minimum of 8 characters is required.',
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input height="$4xl">
                <Input.Area
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
              </Input>
            )}
            name="password"
          />
          <Controller
            control={control}
            rules={{
              required: 'Enter the password again for confirmation.',
              validate: (value, { password }) =>
                value === password || 'Passwords must match.',
            }}
            render={({ field: { ref, onChange, onBlur, value } }) => (
              <Input height="$4xl">
                <Input.Area
                  placeholder="Confirm password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={onSubmit}
                  value={value}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  enablesReturnKeyAutomatically
                />
              </Input>
            )}
            name="confirmPassword"
          />
          {errors.password || errors.confirmPassword ? (
            <Text color="$red">
              {errors.password?.message ?? errors.confirmPassword?.message}
            </Text>
          ) : null}
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
