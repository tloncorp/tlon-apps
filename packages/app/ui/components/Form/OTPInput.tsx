import { useCallback, useEffect, useRef } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import { Text, View, XStack } from 'tamagui';

import { Field } from '../../';

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
  const inputRef = useRef<RNTextInput>(null);
  const fullValue = value.join('');

  const handleChangeText = useCallback(
    (text: string) => {
      const sanitizedText = text.replace(/\D/g, '').slice(0, length);
      const nextCode = sanitizedText.split('');
      while (nextCode.length < length) {
        nextCode.push('');
      }
      onChange?.(nextCode);
    },
    [onChange, length]
  );

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    });
  }, []);

  return (
    <Field
      label={`Check your ${mode} for a confirmation code`}
      error={error}
      justifyContent="center"
      alignItems="center"
    >
      <XStack gap="$s" position="relative">
        {Array.from({ length }).map((_, i) => {
          const digit = value[i] || '';
          const isFocused = fullValue.length === i;
          return (
            <View
              key={i}
              borderWidth={1}
              borderColor={isFocused ? '$blue' : '$border'}
              borderRadius="$s"
              width="$4xl"
              height="$4xl"
              justifyContent="center"
              alignItems="center"
              backgroundColor="$background"
              pointerEvents="none"
            >
              <Text fontSize="$2xl" fontWeight="600" color="$foreground">
                {digit}
              </Text>
            </View>
          );
        })}
        <RNTextInput
          ref={inputRef}
          value={fullValue}
          onChangeText={handleChangeText}
          keyboardType="number-pad"
          autoComplete="off"
          caretHidden
          contextMenuHidden={false}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.01,
            color: 'transparent',
            fontSize: 1,
            backgroundColor: 'transparent',
          }}
        />
      </XStack>
    </Field>
  );
}
