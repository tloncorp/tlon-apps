import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Field,
  GenericHeader,
  SizableText,
  Text,
  TextInput,
  View,
  YStack,
} from '@tloncorp/ui';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

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

  // Disable back button
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        e.preventDefault();
      }),
    [navigation]
  );

  return (
    <View flex={1}>
      <GenericHeader
        title="Nickname"
        rightContent={
          <Button minimal onPress={onSubmit}>
            <Text fontSize="$m">Next</Text>
          </Button>
        }
      />
      <YStack gap="$xl" padding="$2xl">
        <SizableText color="$primaryText">
          Choose the nickname you want to use on the Tlon network. By default,
          you will use a pseudonymous identifier.
        </SizableText>
        <Controller
          control={control}
          name="nickname"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field label="Nickname" error={errors.nickname?.message}>
              <TextInput
                value={value}
                placeholder="Choose a display name"
                onBlur={onBlur}
                onChangeText={onChange}
                onSubmitEditing={onSubmit}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="send"
                enablesReturnKeyAutomatically
              />
            </Field>
          )}
        />
      </YStack>
    </View>
  );
};
