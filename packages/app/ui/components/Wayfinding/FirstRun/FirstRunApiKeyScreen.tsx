import { Pressable, Text } from '@tloncorp/ui';
import * as Clipboard from 'expo-clipboard';
import { useCallback } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { Field, TextInput } from '../../Form';
import { LineStepFrame } from '../../Onboarding/line/LineStepFrame';
import { FIRST_RUN_STEPS, firstRunCopy } from './firstRunCopy';
import { API_KEY_PROVIDERS } from './firstRunModelOptions';

const copy = firstRunCopy.apiKey;

/** Part of the model step: pick the provider and paste a key, which is then checked. */
export function FirstRunApiKeyScreen({
  provider,
  apiKey,
  checking,
  error,
  onProviderChange,
  onApiKeyChange,
  onSubmit,
  onBack,
}: {
  provider: string;
  apiKey: string;
  checking: boolean;
  error: string | null;
  onProviderChange: (provider: string) => void;
  onApiKeyChange: (key: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const providerLabel =
    API_KEY_PROVIDERS.find((option) => option.id === provider)?.label ??
    provider;

  const handlePaste = useCallback(async () => {
    if (checking) return;
    try {
      const contents = isWeb
        ? await navigator.clipboard.readText()
        : await Clipboard.getStringAsync();
      onApiKeyChange(contents.trim());
    } catch {
      // Nothing to paste, or no permission; typing still works.
    }
  }, [checking, onApiKeyChange]);

  return (
    <KeyboardAvoidingView behavior="height" automaticOffset style={{ flex: 1 }}>
      <LineStepFrame
        step={FIRST_RUN_STEPS.model}
        onBack={checking ? undefined : onBack}
        title={copy.title}
        subtitle={copy.subtitle}
        align="top"
        primary={{
          label: checking ? copy.checking : copy.primary,
          onPress: onSubmit,
          loading: checking,
          disabled: !apiKey,
          testID: 'first-run-primary',
        }}
        testID="first-run-api-key"
      >
        <YStack marginHorizontal="$2xl" gap="$xl">
          <YStack gap="$s">
            <Text
              paddingHorizontal="$xs"
              fontSize={13}
              lineHeight={16}
              fontWeight="500"
              color="$secondaryText"
            >
              {copy.providerLabel}
            </Text>
            <XStack
              borderWidth={1}
              borderColor="$border"
              borderRadius={14}
              overflow="hidden"
              accessibilityRole="radiogroup"
            >
              {API_KEY_PROVIDERS.map((option, index) => {
                const selected = option.id === provider;
                return (
                  <Pressable
                    key={option.id}
                    flex={1}
                    // The key being checked belongs to the picked provider.
                    onPress={
                      checking ? undefined : () => onProviderChange(option.id)
                    }
                    disabled={checking}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: selected,
                      disabled: checking,
                    }}
                    testID={`first-run-api-key-provider-${option.id}`}
                  >
                    <View
                      height={44}
                      alignItems="center"
                      justifyContent="center"
                      paddingHorizontal="$xs"
                      opacity={checking && !selected ? 0.5 : 1}
                      backgroundColor={
                        selected ? '$positiveBackground' : '$background'
                      }
                      borderLeftWidth={index === 0 ? 0 : 1}
                      borderColor="$border"
                    >
                      {/* Four equal segments leave about 90pt each on a
                          402pt phone, too narrow for "OpenRouter" plus a
                          checkmark. The fill marks the selection, and the
                          label shrinks rather than clipping when narrower. */}
                      <Text
                        fontSize={14}
                        lineHeight={20}
                        fontWeight={selected ? '500' : '400'}
                        color={
                          selected ? '$positiveActionText' : '$primaryText'
                        }
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {option.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </XStack>
          </YStack>
          <Field
            label={copy.keyLabel(providerLabel)}
            error={error ?? undefined}
          >
            <TextInput
              value={apiKey}
              editable={!checking}
              onChangeText={onApiKeyChange}
              placeholder={copy.keyPlaceholder}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={apiKey ? onSubmit : undefined}
              rightControls={
                <TextInput.InnerButton
                  label={copy.paste}
                  onPress={handlePaste}
                />
              }
            />
          </Field>
        </YStack>
      </LineStepFrame>
    </KeyboardAvoidingView>
  );
}
