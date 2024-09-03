import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestNotificationToken } from '@tloncorp/app/lib/notifications';
import { trackError } from '@tloncorp/app/utils/posthog';
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

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetNickname'>;

type FormData = {
  nickname?: string;
  notificationToken?: string | undefined;
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
    setValue,
  } = useForm<FormData>({
    defaultValues: {
      nickname: signUpExtras.nickname,
      notificationToken: undefined,
    },
  });

  const onSubmit = handleSubmit(({ nickname, notificationToken }) => {
    navigation.navigate('SetTelemetry', {
      user,
      signUpExtras: {
        ...signUpExtras,
        nickname,
        notificationToken,
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

  useEffect(() => {
    async function getNotificationToken() {
      let token: string | undefined;
      try {
        token = await requestNotificationToken();
        setValue('notificationToken', token);
      } catch (err) {
        console.error('Error enabling notifications:', err);
        if (err instanceof Error) {
          trackError(err);
        }
      }
    }
    getNotificationToken();
  }, [setValue]);

  return (
    <View flex={1}>
      <GenericHeader
        title="Nickname"
        showSessionStatus={false}
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
