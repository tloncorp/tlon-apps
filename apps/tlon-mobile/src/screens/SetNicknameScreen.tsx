import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { HeaderButton } from '../components/HeaderButton';
import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetNickname'>;

type FormData = {
  nickname?: string;
};

export const SetNicknameScreen = ({
  navigation,
  route: {
    params: { user, signUpExtras },
  },
}: Props) => {
  const tailwind = useTailwind();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      nickname: signUpExtras.nickname,
    },
  });

  const onSubmit = handleSubmit(({ nickname }) => {
    navigation.navigate('SetNotifications', {
      user,
      signUpExtras: {
        ...signUpExtras,
        nickname,
      },
    });
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderButton title="Next" onPress={onSubmit} />,
    });
  }, [navigation]);

  // Disable back button
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        e.preventDefault();
      }),
    [navigation]
  );

  return (
    <View style={tailwind('p-6 h-full bg-white dark:bg-black')}>
      <Text
        style={tailwind(
          'text-lg font-medium text-tlon-black-80 dark:text-white'
        )}
      >
        Name
      </Text>
      <Text style={tailwind('mb-6 text-lg font-medium text-tlon-black-40')}>
        Choose the name you want to use on the network.
      </Text>
      <Controller
        control={control}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={tailwind(
              'p-4 text-tlon-black-80 dark:text-white border border-tlon-black-20 dark:border-tlon-black-80 rounded-lg'
            )}
            placeholder="Choose a display name"
            placeholderTextColor="#999999"
            onBlur={onBlur}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            value={value}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="send"
            enablesReturnKeyAutomatically
          />
        )}
        name="nickname"
      />
      {errors.nickname ? (
        <Text style={tailwind('mt-2 text-tlon-red')}>
          {errors.nickname.message}
        </Text>
      ) : null}
    </View>
  );
};
