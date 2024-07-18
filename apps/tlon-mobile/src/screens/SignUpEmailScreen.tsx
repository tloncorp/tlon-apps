import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useState } from 'react';
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
import {
  DEFAULT_LURE,
  DEFAULT_PRIORITY_TOKEN,
  EMAIL_REGEX,
} from '../constants';
import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { getHostingAvailability } from '../lib/hostingApi';
import type { OnboardingStackParamList } from '../types';
import { trackError, trackOnboardingAction } from '../utils/posthog';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpEmail'>;

type FormData = {
  email: string;
};

export const SignUpEmailScreen = ({
  navigation,
  route: {
    params: {
      lure = DEFAULT_LURE,
      priorityToken = DEFAULT_PRIORITY_TOKEN,
    } = {},
  },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tailwind = useTailwind();
  const isDarkMode = useIsDarkMode();

  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormData>();

  const onSubmit = handleSubmit(async ({ email }) => {
    setIsSubmitting(true);

    try {
      const { enabled, validEmail } = await getHostingAvailability({
        email,
        lure,
        priorityToken,
      });

      if (!enabled) {
        navigation.navigate('JoinWaitList', { email, lure });
      } else if (!validEmail) {
        setError('email', {
          type: 'custom',
          message:
            'This email address is ineligible for signup. Please contact support@tlon.io',
        });
        trackError({ message: 'Ineligible email address' });
      } else {
        trackOnboardingAction({
          actionName: 'Email submitted',
          email,
          lure,
        });
        navigation.navigate('EULA', { email, lure, priorityToken });
      }
    } catch (err) {
      console.error('Error getting hosting availability:', err);
      if (err instanceof Error) {
        setError('email', {
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
      headerLeft: () => (
        <HeaderButton title="Back" onPress={() => navigation.goBack()} />
      ),
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

  return (
    <KeyboardAvoidingView
      behavior="height"
      style={tailwind('p-6 h-full bg-white dark:bg-black')}
      keyboardVerticalOffset={90}
    >
      <ScrollView style={tailwind('pb-40')}>
        <Text
          style={tailwind(
            'text-lg font-medium text-tlon-black-80 dark:text-white'
          )}
        >
          Hosting with Tlon makes running your Urbit easy and reliable. Sign up
          for a free account and your very own Urbit ID.
        </Text>
        <View style={tailwind('mt-8')}>
          <Text
            style={tailwind(
              'mb-2 text-lg font-medium text-tlon-black-80 dark:text-white'
            )}
          >
            Email
          </Text>
          <Controller
            control={control}
            rules={{
              required: 'Please enter a valid email address.',
              pattern: {
                value: EMAIL_REGEX,
                message: 'Please enter a valid email address.',
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={tailwind(
                  'p-4 text-tlon-black-80 dark:text-white border border-tlon-black-20 dark:border-tlon-black-80 rounded-lg'
                )}
                placeholder="sampel@pal.net"
                placeholderTextColor="#999999"
                onBlur={onBlur}
                onChangeText={onChange}
                onSubmitEditing={onSubmit}
                value={value}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                enablesReturnKeyAutomatically
              />
            )}
            name="email"
          />
          {errors.email ? (
            <Text style={tailwind('mt-2 text-tlon-red')}>
              {errors.email.message}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
