import { createRef, useCallback, useEffect, useMemo } from 'react';
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
  const inputRefs = useMemo(
    () => Array.from({ length }).map(() => createRef<RNTextInput>()),
    [length]
  );

  const handleChangeText = useCallback(
    (index: number, text: string) => {
      console.log(`change text`, index, text);
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
      // hack to get the placeholders to show up on initial render
      if (Platform.OS === 'web') {
        for (let i = 0; i < inputRefs.length; i += 1) {
          inputRefs[i].current?.focus();
        }
      }
      inputRefs[0].current?.focus();
    });
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
