import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  GenericHeader,
  Input,
  SizableText,
  Text,
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
          render={({ field: { onChange, onBlur, value } }) => (
            <Input height="$4xl">
              <Input.Area
                placeholder="Choose a display name"
                onBlur={onBlur}
                onChangeText={onChange}
                onSubmitEditing={onSubmit}
                value={value}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="send"
                enablesReturnKeyAutomatically
              />
            </Input>
          )}
          name="nickname"
        />
        {errors.nickname ? (
          <SizableText color="$negativeActionText" fontSize="$s" marginTop="$m">
            {errors.nickname.message}
          </SizableText>
        ) : null}
      </YStack>
    </View>
  );
};
