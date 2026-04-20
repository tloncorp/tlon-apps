import {
  DEFAULT_BOT_CONFIG,
  MODEL_OPTIONS,
  RESPONSE_STYLE_OPTIONS,
  type ResponseStyle,
} from '@tloncorp/shared/domain';
import {
  DEFAULT_BOTTOM_PADDING,
  KEYBOARD_EXTRA_PADDING,
  KeyboardAvoidingView,
  Pressable,
} from '@tloncorp/ui';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, Text, View, XStack, YStack, useTheme } from 'tamagui';

import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import {
  ControlledTextField,
  Field,
  FormFrame,
} from './Form';
import { ModelOptionCard } from './ModelOptionCard';
import { ScreenHeader } from './ScreenHeader';

export interface BotBehaviorFormData {
  model: string;
  apiKey: string;
  responseStyle: ResponseStyle;
  activeHoursStart: string;
  activeHoursEnd: string;
}

interface Props {
  onGoBack: () => void;
  onSave: (data: BotBehaviorFormData) => void;
  initialValues?: Partial<BotBehaviorFormData>;
  isSaving?: boolean;
}

export function BotBehaviorScreenView({
  onGoBack,
  onSave,
  initialValues,
  isSaving,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollViewRef, keyboardHeight } = useKeyboardAwareScroll();

  const { control, handleSubmit, setValue, watch } =
    useForm<BotBehaviorFormData>({
      mode: 'onChange',
      defaultValues: {
        model: initialValues?.model ?? DEFAULT_BOT_CONFIG.model,
        apiKey: initialValues?.apiKey ?? '',
        responseStyle:
          initialValues?.responseStyle ?? DEFAULT_BOT_CONFIG.responseStyle,
        activeHoursStart:
          initialValues?.activeHoursStart ??
          String(DEFAULT_BOT_CONFIG.activeHoursStart),
        activeHoursEnd:
          initialValues?.activeHoursEnd ??
          String(DEFAULT_BOT_CONFIG.activeHoursEnd),
      },
    });

  const currentModel = watch('model');
  const currentResponseStyle = watch('responseStyle');
  const selectedModelOption = MODEL_OPTIONS.find(
    (o) => o.value === currentModel
  );
  const needsApiKey = selectedModelOption?.requiresKey ?? false;

  const handlePressSave = useCallback(() => {
    handleSubmit((data) => {
      onSave(data);
    })();
  }, [handleSubmit, onSave]);

  return (
    <View flex={1} backgroundColor={theme.background.val}>
      <ScreenHeader
        title="Bot Behavior"
        backAction={onGoBack}
        rightControls={
          <ScreenHeader.TextButton
            onPress={handlePressSave}
            color="$positiveActionText"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
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
            {/* Model Picker */}
            <Field label="Model provider">
              <YStack gap="$s">
                {MODEL_OPTIONS.map((option) => (
                  <ModelOptionCard
                    key={option.value}
                    option={option}
                    selected={currentModel === option.value}
                    onPress={() =>
                      setValue('model', option.value, { shouldDirty: true })
                    }
                  />
                ))}
              </YStack>
            </Field>

            {/* API Key (conditional) */}
            {needsApiKey && (
              <ControlledTextField
                name="apiKey"
                label={`${selectedModelOption?.label} API key`}
                control={control}
                inputProps={{
                  placeholder: 'sk-...',
                  autoCapitalize: 'none',
                  autoCorrect: false,
                  secureTextEntry: true,
                }}
                rules={{
                  required: needsApiKey
                    ? 'API key is required for this provider'
                    : false,
                }}
              />
            )}

            {/* Response Style Toggle */}
            <Field label="Response style">
              <XStack
                borderRadius="$l"
                borderWidth={1}
                borderColor="$border"
                overflow="hidden"
              >
                {RESPONSE_STYLE_OPTIONS.map((option, index) => {
                  const isSelected = currentResponseStyle === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() =>
                        setValue('responseStyle', option.value, {
                          shouldDirty: true,
                        })
                      }
                      style={{ flex: 1 }}
                    >
                      <View
                        flex={1}
                        paddingVertical="$m"
                        alignItems="center"
                        backgroundColor={
                          isSelected ? '$primaryText' : 'transparent'
                        }
                        borderRightWidth={
                          index < RESPONSE_STYLE_OPTIONS.length - 1 ? 1 : 0
                        }
                        borderRightColor="$border"
                      >
                        <Text
                          fontSize={14}
                          fontWeight="500"
                          color={isSelected ? 'white' : '$primaryText'}
                        >
                          {option.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </XStack>
            </Field>

            {/* Active Hours */}
            <XStack gap="$m">
              <View flex={1}>
                <ControlledTextField
                  name="activeHoursStart"
                  label="Active from (hour)"
                  control={control}
                  inputProps={{
                    placeholder: '0',
                    keyboardType: 'number-pad',
                  }}
                  rules={{
                    validate: (v: string) => {
                      const n = Number(v);
                      if (isNaN(n) || n < 0 || n > 23) {
                        return 'Must be 0-23';
                      }
                      return true;
                    },
                  }}
                />
              </View>
              <View flex={1}>
                <ControlledTextField
                  name="activeHoursEnd"
                  label="Active until (hour)"
                  control={control}
                  inputProps={{
                    placeholder: '24',
                    keyboardType: 'number-pad',
                  }}
                  rules={{
                    validate: (v: string) => {
                      const n = Number(v);
                      if (isNaN(n) || n < 1 || n > 24) {
                        return 'Must be 1-24';
                      }
                      return true;
                    },
                  }}
                />
              </View>
            </XStack>

            <XStack paddingHorizontal="$xs">
              <Text fontSize={12} color="$tertiaryText">
                Timezone: {DEFAULT_BOT_CONFIG.timezone}
              </Text>
            </XStack>
          </FormFrame>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
