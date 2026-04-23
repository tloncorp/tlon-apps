import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
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
const NICKNAME_SETUP_STARTING_DELAY_MS = 1000;
const NICKNAME_SETUP_MAX_DELAY_MS = 4000;
const NICKNAME_SETUP_NUM_ATTEMPTS = 6;

function getRetryDelayMs(attemptNumber: number) {
  return Math.min(
    NICKNAME_SETUP_STARTING_DELAY_MS *
      Math.pow(2, Math.max(attemptNumber - 1, 0)),
    NICKNAME_SETUP_MAX_DELAY_MS
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getAttemptsUsed(retryCount: number) {
  return Math.min(retryCount + 1, NICKNAME_SETUP_NUM_ATTEMPTS);
}

export const SetNicknameScreen = ({ navigation }: Props) => {
  const theme = useTheme();

  const facesImage = theme.dark
    ? require('../../../assets/images/faces-dark.png')
    : require('../../../assets/images/faces.png');

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      nickname: DEFAULT_ONBOARDING_NICKNAME ?? '',
    },
  });

  const signupContext = useSignupContext();

  const onSubmit = handleSubmit(({ nickname }) => {
    let retryCount = 0;

    signupContext.setOnboardingValues({
      nickname,
      userWasReadyAt: Date.now(),
    });

    // once they've decided on a nickname, we need to re-title their bot
    // and update the name of their home group
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

        const isBotEnabled = await db.hostingBotEnabled.getValue();
        if (isBotEnabled) {
          const botNickname = `${nickname}'s TlonBot 🌱`;
          await api.setTlawnNickname(userId, botNickname);
        }
      },
      {
        startingDelay: NICKNAME_SETUP_STARTING_DELAY_MS,
        numOfAttempts: NICKNAME_SETUP_NUM_ATTEMPTS,
        maxDelay: NICKNAME_SETUP_MAX_DELAY_MS,
        retry: (error, retryNumber) => {
          retryCount = retryNumber;
          const willRetry = retryNumber < NICKNAME_SETUP_NUM_ATTEMPTS;

          logger.trackEvent(
            willRetry
              ? 'Set nickname retry scheduled'
              : 'Set nickname retries exhausted',
            {
              attemptsUsed: willRetry
                ? retryNumber
                : NICKNAME_SETUP_NUM_ATTEMPTS,
              error: getErrorMessage(error),
              maxAttempts: NICKNAME_SETUP_NUM_ATTEMPTS,
              nextDelayMs: willRetry ? getRetryDelayMs(retryNumber) : null,
              retryNumber,
            }
          );

          return willRetry;
        },
      }
    )
      .then(() => {
        if (retryCount > 0) {
          logger.trackEvent('Set nickname retry recovered', {
            attemptsUsed: getAttemptsUsed(retryCount),
            maxAttempts: NICKNAME_SETUP_NUM_ATTEMPTS,
            retryCount,
          });
        }
      })
      .catch((err) => {
        logger.trackError(
          'Failed to set nickname on bot ship or update Home Group',
          {
            attemptsUsed: getAttemptsUsed(retryCount),
            error: getErrorMessage(err),
            retryCount,
          }
        );
      });

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
