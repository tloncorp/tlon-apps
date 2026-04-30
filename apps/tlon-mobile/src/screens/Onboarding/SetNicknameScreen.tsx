import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_ONBOARDING_NICKNAME } from '@tloncorp/app/constants';
import {
  Field,
  KeyboardAvoidingView,
  SplashParagraph,
  SplashTitle,
  TextInput,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  getNicknameErrorMessage,
  validateNickname,
  withRetry,
} from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Button, Text } from '@tloncorp/ui';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetNickname'>;

type FormData = {
  nickname?: string;
};

const logger = createDevLogger('SetNicknameScreen', false);

export const SetNicknameScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();

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
    signupContext.setOnboardingValues({
      nickname,
      userWasReadyAt: Date.now(),
    });

    db.splashNickname.setValue(nickname ?? '');

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
    <KeyboardAvoidingView keyboardVerticalOffset={0}>
      <View
        flex={1}
        backgroundColor="$background"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      >
        <YStack flex={1} gap="$2xl" paddingTop="$2xl">
          <SplashTitle>
            Choose your <Text color="$positiveActionText">nickname.</Text>
          </SplashTitle>
          <SplashParagraph marginBottom={0}>
            Choose the nickname you want to use on the Tlon network.
          </SplashParagraph>
          <YStack paddingHorizontal="$2xl" gap="$m">
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
                <Field error={errors.nickname?.message}>
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
                    frameStyle={{
                      height: 72,
                      borderWidth: 0,
                      paddingLeft: 0,
                      paddingRight: 0,
                    }}
                    style={{ fontSize: 24, fontWeight: '600' }}
                  />
                </Field>
              )}
            />
          </YStack>
        </YStack>
        <Button
          onPress={onSubmit}
          label="Next"
          preset="hero"
          disabled={!isValid}
          shadow={isValid}
          marginHorizontal="$2xl"
          marginTop="$xl"
        />
      </View>
    </KeyboardAvoidingView>
  );
};
