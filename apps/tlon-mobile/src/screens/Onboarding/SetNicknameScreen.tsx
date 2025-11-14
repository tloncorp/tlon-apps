import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_ONBOARDING_NICKNAME } from '@tloncorp/app/constants';
import { requestNotificationToken } from '@tloncorp/app/lib/notifications';
import {
  Field,
  Image,
  ScreenHeader,
  TextInput,
  TlonText,
  View,
  XStack,
  YStack,
  useTheme,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import {
  getNicknameErrorMessage,
  validateNickname,
} from '@tloncorp/shared/logic';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetNickname'>;

type FormData = {
  nickname?: string;
  notificationToken?: string | undefined;
};

const logger = createDevLogger('SetNicknameScreen', true);

export const SetNicknameScreen = ({ navigation }: Props) => {
  const theme = useTheme();

  const facesImage = theme.dark
    ? require('../../../assets/images/faces-dark.png')
    : require('../../../assets/images/faces.png');

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
  } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      nickname: DEFAULT_ONBOARDING_NICKNAME ?? '',
      notificationToken: undefined,
    },
  });

  const signupContext = useSignupContext();

  const onSubmit = handleSubmit(({ nickname, notificationToken }) => {
    signupContext.setOnboardingValues({
      nickname,
      notificationToken,
      userWasReadyAt: Date.now(),
    });

    navigation.push('ReserveShip');
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
          logger.trackError('Error enabling notifications', err);
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
          <Image height={155} aspectRatio={862 / 609} source={facesImage} />
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
            maxLength: {
              value: 30,
              message: 'Your nickname is limited to 30 characters',
            },
            validate: (value) => {
              const result = validateNickname(value ?? '', '');
              if (!result.isValid) {
                return getNicknameErrorMessage(result.errorType);
              }
              return true;
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
