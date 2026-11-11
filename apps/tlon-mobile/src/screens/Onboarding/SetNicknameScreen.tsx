import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_ONBOARDING_NICKNAME } from '@tloncorp/app/constants';
import {
  AVATAR_GLYPH_IDS,
  type AvatarGlyphId,
  AvatarGlyphPicker,
  LineButton,
  LineOutline,
  LineStepFrame,
  Text,
  TextInput,
  View,
  YStack,
  isWeb,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  getNicknameErrorMessage,
  validateNickname,
  withRetry,
} from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetNickname'>;

type FormData = {
  nickname?: string;
};

const logger = createDevLogger('SetNicknameScreen', false);

const NEXT_HEIGHT = 56;
/** Next rides this far above the keyboard. */
const NEXT_GAP = 12;

/**
 * Profile, step 1 of onboarding: pick an avatar glyph, then a name. The pick
 * is saved as your avatar, and your Tlonbot's, once your computer is ready;
 * the rest of onboarding draws your Tlonbot in it. Someone reviving an
 * existing Tlonbot keeps their avatar, so they only see the name.
 */
export const SetNicknameScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const signupContext = useSignupContext();
  const isTlonbotRevival = signupContext.onboardingFlow === 'tlonbotRevival';
  const isRevivalOnboarding = isTlonbotRevival;
  const [glyph, setGlyph] = useState<AvatarGlyphId>(AVATAR_GLYPH_IDS[0]);

  // Bumped when the revival prefill lands so the uncontrolled native input
  // remounts and picks up the new defaultValue.
  const [prefillKey, setPrefillKey] = useState(0);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      nickname: isRevivalOnboarding ? '' : (DEFAULT_ONBOARDING_NICKNAME ?? ''),
    },
  });

  const onSubmit = handleSubmit(({ nickname }) => {
    // iOS autocapitalize/autocomplete readily leaves a trailing space, which
    // then shows up in derived names like "Sampel 's Group".
    const trimmedNickname = nickname?.trim();

    signupContext.setOnboardingValues({
      nickname: trimmedNickname,
      userWasReadyAt: Date.now(),
    });

    db.splashNickname.setValue(trimmedNickname ?? '');
    if (!isTlonbotRevival) {
      db.onboardingAvatar.setValue({ glyph, saved: false });
    }

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

          if (!trimmedNickname) {
            throw new Error('No nickname provided during nickname setup');
          }

          await store.updateCurrentUserProfile(
            { nickname: trimmedNickname },
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
        setPrefillKey((key) => key + 1);
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

  const error = errors.nickname?.message;
  const nextButton = (
    <LineButton
      label="Next"
      onPress={() => onSubmit()}
      disabled={!isValid}
      testID="set-nickname-next"
    />
  );

  return (
    <LineStepFrame
      step={1}
      title="Profile"
      subtitle={
        isRevivalOnboarding
          ? 'Choose the name you want to be known as.'
          : 'Pick an avatar, then choose the name you want to be known as.'
      }
      align="top"
      keyboardBottomOffset={NEXT_HEIGHT + 2 * NEXT_GAP}
      footer={
        // Next rides on top of the keyboard while you type, so the avatars and
        // the field stay where they are.
        <KeyboardStickyView
          offset={{
            closed: 0,
            opened: Math.max(insets.bottom, 14) + 10 - NEXT_GAP,
          }}
        >
          <View paddingHorizontal="$2xl">{nextButton}</View>
        </KeyboardStickyView>
      }
    >
      {isRevivalOnboarding ? null : (
        <View marginBottom={24}>
          <AvatarGlyphPicker value={glyph} onChange={setGlyph} />
        </View>
      )}
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
            message: 'Your name is limited to 30 characters',
          },
          validate: (value) => {
            if (!value?.trim()) {
              return 'Please enter a nickname.';
            }
            const result = validateNickname(value.trim(), '');
            if (!result.isValid) {
              return getNicknameErrorMessage(result.errorType);
            }
            return true;
          },
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap={8}>
            {/* An error takes the label's place: under the field there's no
                room once the keyboard and Next are up. */}
            <Text
              marginHorizontal={40}
              fontSize={14}
              lineHeight={20}
              letterSpacing={-0.187}
              color={error ? '$negativeActionText' : '$primaryText'}
              accessibilityLiveRegion={error ? 'polite' : undefined}
              nativeID="set-nickname-label"
            >
              {error ?? 'Your name'}
            </Text>
            <View marginHorizontal="$2xl">
              <TextInput
                key={prefillKey}
                // Echoing a controlled value back mid-IME-composition
                // duplicates the composed text on Android (stale
                // mostRecentEventCount), so native stays uncontrolled;
                // defaultValue seeds the form value, and the key remount
                // re-seeds it when the async revival prefill lands.
                value={isWeb ? value : undefined}
                defaultValue={isWeb ? undefined : value}
                placeholder="Sampel Palnet"
                onBlur={onBlur}
                onChangeText={onChange}
                onSubmitEditing={() => onSubmit()}
                autoFocus={isRevivalOnboarding}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="send"
                enablesReturnKeyAutomatically
                accessibilityLabelledBy="set-nickname-label"
                frameStyle={{
                  borderWidth: 0,
                  borderRadius: 12,
                  paddingLeft: 16,
                  paddingRight: 12,
                  backgroundColor: error
                    ? '$negativeBackground'
                    : '$background',
                }}
                testID="set-nickname-input"
              />
              <LineOutline
                radius={12}
                color={error ? '$negativeActionText' : '$primaryText'}
              />
            </View>
          </YStack>
        )}
      />
    </LineStepFrame>
  );
};
