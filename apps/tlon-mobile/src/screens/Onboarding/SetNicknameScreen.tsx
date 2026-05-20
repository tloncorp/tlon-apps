import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_ONBOARDING_NICKNAME } from '@tloncorp/app/constants';
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
import * as db from '@tloncorp/shared/db';
import {
  getNicknameErrorMessage,
  validateNickname,
  withRetry,
} from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetNickname'>;

type FormData = {
  nickname?: string;
};

const logger = createDevLogger('SetNicknameScreen', false);

export const SetNicknameScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const signupContext = useSignupContext();
  const isTlonbotRevival = signupContext.onboardingFlow === 'tlonbotRevival';
  const isRevivalOnboarding = isTlonbotRevival;

  const facesImage = theme.dark
    ? require('../../../assets/images/faces-dark.png')
    : require('../../../assets/images/faces.png');

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      nickname: isRevivalOnboarding ? '' : DEFAULT_ONBOARDING_NICKNAME ?? '',
    },
  });

  const onSubmit = handleSubmit(({ nickname }) => {
    signupContext.setOnboardingValues({
      nickname,
      userWasReadyAt: Date.now(),
    });

    db.splashNickname.setValue(nickname ?? '');

    if (!isTlonbotRevival) {
      // Once they've decided on a nickname, keep the existing best-effort
      // profile update for signup. TlonBot revival defers this until Hosting
      // reports the bot home group is provisioned.
      withRetry(
        async () => {
          const userId = await db.hostedUserNodeId.getValue();
          if (!userId) {
            throw new Error('No user ID found during nickname setup');
          }

          if (!nickname) {
            throw new Error('No nickname provided during nickname setup');
          }

          await store.updateCurrentUserProfile(
            { nickname },
            { shouldThrow: true }
          );
        },
        {
          startingDelay: 1000,
          numOfAttempts: 4,
          maxDelay: 4000,
          retry: (error, retryNumber) => {
            if (retryNumber < 4) {
              logger.trackEvent('Set nickname failed, retrying', {
                error: error instanceof Error ? error.message : String(error),
              });
              return true;
            }

            return false;
          },
        }
      ).catch((err) => {
        logger.trackError(
          'Failed to set nickname on bot ship or update Home Group',
          {
            error: err instanceof Error ? err.message : String(err),
          }
        );
      });
    }

    navigation.push('SetNotifications');
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
    if (!isRevivalOnboarding) {
      return;
    }

    let cancelled = false;
    (async () => {
      const shipId = await db.hostedUserNodeId.getValue();
      if (!shipId) {
        return;
      }

      const currentUser = await db.getContact({ id: `~${shipId}` });
      const existingNickname =
        currentUser?.peerNickname?.trim() || currentUser?.nickname?.trim();
      if (existingNickname && !cancelled) {
        setValue('nickname', existingNickname, { shouldValidate: true });
      }
    })().catch((err) => {
      logger.trackError('Failed to prefill revival nickname', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isRevivalOnboarding, setValue]);

  return (
    <View flex={1} backgroundColor={'$secondaryBackground'}>
      <ScreenHeader
        title="Nickname"
        backgroundColor="$secondaryBackground"
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
          Choose the nickname you want to use on the Tlon network.
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
                autoFocus
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
