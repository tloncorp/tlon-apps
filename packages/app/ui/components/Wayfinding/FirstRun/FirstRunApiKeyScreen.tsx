import { Icon, Pressable, Text } from '@tloncorp/ui';
import * as Clipboard from 'expo-clipboard';
import { useCallback } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { Field, TextInput } from '../../Form';
import { FirstRunFrame } from './FirstRunFrame';
import { firstRunCopy } from './firstRunCopy';
import { API_KEY_PROVIDERS } from './firstRunModelOptions';
import type { FirstRunSetupStatus } from './types';

const copy = firstRunCopy.apiKey;

/** Part of screen 4: pick the provider and paste a key, which is then checked. */
export function FirstRunApiKeyScreen({
  status,
  provider,
  apiKey,
  checking,
  error,
  onProviderChange,
  onApiKeyChange,
  onSubmit,
  onBack,
}: {
  status: FirstRunSetupStatus;
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
    try {
      const contents = isWeb
        ? await navigator.clipboard.readText()
        : await Clipboard.getStringAsync();
      onApiKeyChange(contents.trim());
    } catch {
      // Nothing to paste, or no permission; typing still works.
    }
  }, [onApiKeyChange]);

  return (
    <KeyboardAvoidingView behavior="height" automaticOffset style={{ flex: 1 }}>
      <FirstRunFrame
        step={4}
        onBack={checking ? undefined : onBack}
        title={copy.title}
        accent={copy.accent}
        body={copy.body}
        status={status}
        primaryLabel={checking ? copy.checking : copy.primary}
        onPrimary={onSubmit}
        primaryLoading={checking}
        primaryDisabled={!apiKey}
        testID="first-run-api-key"
      >
        <YStack marginTop="$xl" marginHorizontal="$xl" gap="$xl">
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
                    onPress={() => onProviderChange(option.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    testID={`first-run-api-key-provider-${option.id}`}
                  >
                    <View
                      height={44}
                      alignItems="center"
                      justifyContent="center"
                      backgroundColor={
                        selected ? '$positiveBackground' : '$background'
                      }
                      borderLeftWidth={index === 0 ? 0 : 1}
                      borderColor="$border"
                    >
                      <XStack alignItems="center" gap="$xs">
                        {selected ? (
                          <Icon
                            type="Checkmark"
                            customSize={[12, 12]}
                            color="$positiveActionText"
                          />
                        ) : null}
                        <Text
                          fontSize={14}
                          lineHeight={20}
                          fontWeight={selected ? '500' : '400'}
                          color={
                            selected ? '$positiveActionText' : '$primaryText'
                          }
                        >
                          {option.label}
                        </Text>
                      </XStack>
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
      </FirstRunFrame>
    </KeyboardAvoidingView>
  );
}
