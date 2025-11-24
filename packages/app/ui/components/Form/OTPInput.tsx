import { useCallback, useEffect, useRef } from 'react';
import {
  Platform,
  TextInput as RNTextInput,
  TextInputKeyPressEventData,
} from 'react-native';

import { Field, TextInput, XStack } from '../../';

export function OTPInput({
  length,
  value,
  mode = 'email',
  onChange,
  error,
}: {
  length: number;
  mode: 'email' | 'phone';
  value: string[];
  onChange?: (value: string[]) => void;
  error?: string;
}) {
  // Use useRef to store the refs array so it remains stable across renders
  const inputRefsRef = useRef<React.RefObject<RNTextInput>[]>([]);

  // Initialize refs if they don't exist or length changed
  useEffect(() => {
    inputRefsRef.current = Array.from({ length }).map(
      (_, i) => inputRefsRef.current[i] || { current: null }
    );
  }, [length]);

  const inputRefs = inputRefsRef.current;

  const handleChangeText = useCallback(
    (index: number, text: string) => {
      const nextCode = [...value];

      if (text.length === 0) {
        nextCode[index] = '';
      } else if (text.length > 1) {
        // Handle paste: distribute characters across all boxes
        const sanitizedText = text.replace(/\D/g, '').slice(0, length);
        for (let i = 0; i < sanitizedText.length; i += 1) {
          nextCode[i] = sanitizedText.charAt(i);
        }
        // Focus the last filled input or the next empty one
        const lastFilledIndex = Math.min(sanitizedText.length - 1, length - 1);
        const nextEmptyIndex =
          sanitizedText.length < length ? sanitizedText.length : lastFilledIndex;
        inputRefs[nextEmptyIndex]?.current?.focus();
      } else {
        // Single character input
        nextCode[index] = text.charAt(0);
        // Move to next empty input
        if (index < inputRefs.length - 1 && nextCode[index]) {
          for (let i = index + 1; i < inputRefs.length; i += 1) {
            if (!nextCode[i]) {
              inputRefs[i].current?.focus();
              break;
            }
          }
        }
      }

      onChange?.(nextCode.slice(0, length));
    },
    [onChange, value, inputRefs, length]
  );

  const handleKeyPress = useCallback(
    (index: number, key: TextInputKeyPressEventData['key']) => {
      if (key === 'Backspace' && !value[index] && index > 0) {
        inputRefs[index - 1].current?.focus();
      }
    },
    [value, inputRefs]
  );

  useEffect(() => {
    setTimeout(() => {
      // hack to get the placeholders to show up on initial render
      if (Platform.OS === 'web') {
        for (let i = 0; i < inputRefs.length; i += 1) {
          inputRefs[i].current?.focus();
        }
      }
      inputRefs[0].current?.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Field
      label={`Check your ${mode} for a confirmation code`}
      error={error}
      justifyContent="center"
      alignItems="center"
    >
      <XStack gap="$s">
        {Array.from({ length }).map((_, i) => (
          <TextInput
            textAlign="center"
            key={i}
            ref={inputRefs[i]}
            onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
            placeholder="5"
            onChangeText={(text) => handleChangeText(i, text)}
            value={value.length > i ? value[i] : ''}
            keyboardType="numeric"
            frameStyle={{
              width: '$4xl',
              paddingLeft: 0,
              paddingRight: 0,
            }}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
          />
        ))}
      </XStack>
    </Field>
  );
}
