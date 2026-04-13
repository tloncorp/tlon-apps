import {
  DEFAULT_BOT_CONFIG,
  PERSONALITY_TYPES,
  type PersonalityType,
} from '@tloncorp/shared/domain';
import {
  DEFAULT_BOTTOM_PADDING,
  KEYBOARD_EXTRA_PADDING,
  KeyboardAvoidingView,
} from '@tloncorp/ui';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, Text, View, XStack, YStack, useTheme } from 'tamagui';

import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import { EmojiPicker } from './EmojiPicker';
import { ControlledTextField, Field, FormFrame } from './Form';
import { NameSuggestions } from './NameSuggestions';
import { PersonalityCard } from './PersonalityCard';
import { ScreenHeader } from './ScreenHeader';

export interface BotIdentityFormData {
  name: string;
  emoji: string;
  personalityType: PersonalityType;
  customSoulPrompt?: string;
}

interface Props {
  onGoBack: () => void;
  onContinue: (data: BotIdentityFormData) => void;
  initialValues?: Partial<BotIdentityFormData>;
}

export function BotIdentityScreenView({
  onGoBack,
  onContinue,
  initialValues,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    scrollViewRef,
    keyboardHeight,
  } = useKeyboardAwareScroll();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isValid },
  } = useForm<BotIdentityFormData>({
    mode: 'onChange',
    defaultValues: {
      name: initialValues?.name ?? DEFAULT_BOT_CONFIG.name,
      emoji: initialValues?.emoji ?? DEFAULT_BOT_CONFIG.emoji,
      personalityType:
        initialValues?.personalityType ?? DEFAULT_BOT_CONFIG.personalityType,
      customSoulPrompt: initialValues?.customSoulPrompt ?? '',
    },
  });

  const currentName = watch('name');
  const currentEmoji = watch('emoji');
  const currentPersonality = watch('personalityType');

  const handleNameChipSelect = useCallback(
    (name: string) => {
      setValue('name', name, { shouldValidate: true, shouldDirty: true });
    },
    [setValue]
  );

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      setValue('emoji', emoji, { shouldValidate: true, shouldDirty: true });
    },
    [setValue]
  );

  const handlePersonalitySelect = useCallback(
    (type: PersonalityType) => {
      setValue('personalityType', type, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [setValue]
  );

  const handlePressContinue = useCallback(() => {
    handleSubmit((data) => {
      onContinue(data);
    })();
  }, [handleSubmit, onContinue]);

  const personalityLabel =
    PERSONALITY_TYPES.find((p) => p.value === currentPersonality)?.title ?? '';

  return (
    <View flex={1} backgroundColor={theme.background.val}>
      <ScreenHeader
        title="Bot Identity"
        backAction={onGoBack}
        rightControls={
          <ScreenHeader.TextButton
            onPress={handlePressContinue}
            color="$positiveActionText"
            disabled={!currentName}
          >
            Next
          </ScreenHeader.TextButton>
        }
      />
      <KeyboardAvoidingView>
        <ScrollView
          ref={scrollViewRef}
          keyboardDismissMode="on-drag"
          flex={1}
          contentContainerStyle={{
            width: '100%',
            maxWidth: 600,
            marginHorizontal: 'auto',
            paddingBottom:
              keyboardHeight > 0
                ? keyboardHeight + KEYBOARD_EXTRA_PADDING
                : insets.bottom + DEFAULT_BOTTOM_PADDING,
          }}
        >
          <FormFrame>
            {/* Live Preview */}
            <XStack
              alignItems="center"
              justifyContent="center"
              gap="$m"
              padding="$l"
              borderRadius="$xl"
              backgroundColor="$secondaryBackground"
            >
              <Text fontSize={40}>{currentEmoji}</Text>
              <YStack>
                <Text fontSize={20} fontWeight="500" color="$primaryText">
                  {currentName || 'Your Bot'}
                </Text>
                {personalityLabel ? (
                  <Text fontSize={14} color="$secondaryText">
                    {personalityLabel}
                  </Text>
                ) : null}
              </YStack>
            </XStack>

            {/* Name Input */}
            <YStack gap="$xs">
              <ControlledTextField
                name="name"
                label="Name"
                control={control}
                inputProps={{
                  placeholder: 'Give your bot a name',
                }}
                rules={{
                  required: 'Name is required',
                  maxLength: {
                    value: 30,
                    message: 'Name is limited to 30 characters',
                  },
                }}
              />
              <NameSuggestions
                onSelect={handleNameChipSelect}
                currentValue={currentName}
              />
            </YStack>

            {/* Emoji Picker */}
            <Field label="Emoji">
              <EmojiPicker value={currentEmoji} onSelect={handleEmojiSelect} />
            </Field>

            {/* Personality Type */}
            <YStack gap="$m">
              <Text fontSize={14} color="$tertiaryText">
                Personality
              </Text>
              {PERSONALITY_TYPES.map((option) => (
                <PersonalityCard
                  key={option.value}
                  option={option}
                  selected={currentPersonality === option.value}
                  onPress={() => handlePersonalitySelect(option.value)}
                />
              ))}
            </YStack>
          </FormFrame>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
