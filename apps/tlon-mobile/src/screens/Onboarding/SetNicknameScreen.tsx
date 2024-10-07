import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import { requestNotificationToken } from '@tloncorp/app/lib/notifications';
import { trackError } from '@tloncorp/app/utils/posthog';
import {
  Field,
  Image,
  ScreenHeader,
  TextInput,
  TlonText,
  View,
  XStack,
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
    params: { user },
  },
}: Props) => {
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
  } = useForm<FormData>({
    defaultValues: {
      nickname: '',
      notificationToken: undefined,
    },
  });

  const signupContext = useSignupContext();

  const onSubmit = handleSubmit(({ nickname, notificationToken }) => {
    if (nickname) {
      signupContext.setNickname(nickname);
    }

    if (notificationToken) {
      signupContext.setNotificationToken(notificationToken);
    }

    navigation.navigate('SetTelemetry', {
      user,
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
    <View flex={1} backgroundColor={'$secondaryBackground'}>
      <ScreenHeader
        title="Nickname"
        showSessionStatus={false}
        rightControls={
          <ScreenHeader.TextButton disabled={!isValid} onPress={onSubmit}>
            Next
          </ScreenHeader.TextButton>
        }
      />
      <YStack gap="$xl" paddingHorizontal="$2xl">
        <XStack justifyContent="center" paddingTop="$l">
          <Image
            height={155}
            aspectRatio={862 / 609}
            source={require('../../../assets/images/faces.png')}
          />
        </XStack>

        <TlonText.Text size="$body" padding="$xl">
          Choose the nickname you want to use on the Tlon network. By default,
          you will use a pseudonymous identifier.
        </TlonText.Text>
        <Controller
          control={control}
          name="nickname"
          rules={{
            required: 'Please enter a nickname.',
            minLength: {
              value: 1,
              message: 'Please enter a nickname.',
            },
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Field label="Nickname" error={errors.nickname?.message}>
              <TextInput
                value={value}
                placeholder="Sampel Palnet"
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
