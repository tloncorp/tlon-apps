import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset } from '@tloncorp/app/lib/hostingApi';
import { useLayoutEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { HeaderButton } from '../components/HeaderButton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ResetPassword'>;

type FormData = {
  email: string;
};

export const ResetPasswordScreen = ({
  navigation,
  route: {
    params: { email: emailParam },
  },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const tailwind = useTailwind();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      email: emailParam,
    },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      navigation.goBack();
    } catch (err) {
      return setRemoteError((err as Error).message);
    }

    setIsSubmitting(false);
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isSubmitting ? (
          <View style={tailwind('px-6')}>
            <LoadingSpinner height={16} />
          </View>
        ) : (
          <HeaderButton title="Submit" onPress={onSubmit} isSubmit />
        ),
    });
  }, [navigation, isSubmitting]);

  return (
    <View style={tailwind('p-6 h-full bg-white dark:bg-black')}>
      <Text
        style={tailwind(
          'text-lg font-medium text-tlon-black-80 dark:text-white'
        )}
      >
        Enter the email associated with your Tlon account.
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
        {remoteError ?? errors.email ? (
          <Text style={tailwind('mt-2 text-tlon-red')}>
            {remoteError ?? errors.email?.message}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
