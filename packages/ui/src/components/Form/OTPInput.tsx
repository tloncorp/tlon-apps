import { Field, TextInput, XStack } from '@tloncorp/ui';
import { createRef, useCallback, useEffect, useMemo } from 'react';
import {
  TextInput as RNTextInput,
  TextInputKeyPressEventData,
} from 'react-native';

export function OTPInput({
  length,
  value,
  mode = 'email',
  label,
  onChange,
  error,
}: {
  length: number;
  mode: 'email' | 'phone';
  value: string[];
  onChange?: (value: string[]) => void;
  error?: string;
  label?: string;
}) {
  const inputRefs = useMemo(
    () => Array.from({ length }).map(() => createRef<RNTextInput>()),
    [length]
  );

  const handleChangeText = useCallback(
    (index: number, text: string) => {
      const nextCode = [...value];
      if (text.length === 0) {
        nextCode[index] = '';
      } else {
        for (let i = 0; i < text.length; i += 1) {
          nextCode[index + i] = text.charAt(i);
        }
      }
      if (index < inputRefs.length - 1 && nextCode[index]) {
        for (let i = index + 1; i < inputRefs.length; i += 1) {
          if (!nextCode[i]) {
            inputRefs[i].current?.focus();
            break;
          }
        }
      }
      onChange?.(nextCode.slice(0, length));
    },
    [onChange, value, inputRefs, length]
  );

  const handleKeyPress = async (
    index: number,
    key: TextInputKeyPressEventData['key']
  ) => {
    if (key === 'Backspace' && !value[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  useEffect(() => {
    setTimeout(() => {
      inputRefs[0].current?.focus();
    });
  }, []);

  return (
    <Field
      label={label ?? `Check your ${mode} for a confirmation code`}
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
            placeholder="7"
            onChangeText={(text) => handleChangeText(i, text)}
            value={value.length > i ? value[i] : ''}
            keyboardType="numeric"
            paddingHorizontal="$xl"
            paddingVertical="$xl"
            width="$4xl"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
          />
        ))}
      </XStack>
    </Field>
  );
}
