import {
  RecaptchaAction,
  execute,
  initClient,
} from '@google-cloud/recaptcha-enterprise-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RECAPTCHA_SITE_KEY } from '@tloncorp/app/constants';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import {
  logInHostingUser,
  signUpHostingUser,
} from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { HeaderButton } from '../components/HeaderButton';
import { LoadingSpinner } from '../components/LoadingSpinner';
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
  const tailwind = useTailwind();
  const isDarkMode = useIsDarkMode();
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isSubmitting ? (
          <View style={tailwind('px-4')}>
            <LoadingSpinner height={16} />
          </View>
        ) : (
          <HeaderButton title="Next" onPress={onSubmit} />
        ),
    });
  }, [navigation, isSubmitting, isDarkMode]);

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
    <KeyboardAvoidingView
      behavior="height"
      style={tailwind('p-6 h-full bg-white dark:bg-black')}
      keyboardVerticalOffset={90}
    >
      <ScrollView style={tailwind('pb-40')}>
        <Text
          style={tailwind(
            'mb-2 text-lg font-medium text-tlon-black-80 dark:text-white'
          )}
        >
          Password
        </Text>
        <Controller
          control={control}
          rules={{
            required: 'A password with a minimum of 8 characters is required.',
            minLength: {
              value: 8,
              message: 'A password with a minimum of 8 characters is required.',
            },
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={tailwind(
                'p-4 text-tlon-black-80 dark:text-white border border-tlon-black-20 dark:border-tlon-black-80 rounded-lg'
              )}
              placeholder="Choose a password"
              placeholderTextColor="#999999"
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
            <TextInput
              ref={ref}
              style={tailwind(
                'p-4 mt-3 text-tlon-black-80 dark:text-white border border-tlon-black-20 dark:border-tlon-black-80 rounded-lg'
              )}
              placeholder="Confirm password"
              placeholderTextColor="#999999"
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
          )}
          name="confirmPassword"
        />
        {errors.password || errors.confirmPassword ? (
          <Text style={tailwind('mt-2 text-tlon-red')}>
            {errors.password?.message ?? errors.confirmPassword?.message}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
