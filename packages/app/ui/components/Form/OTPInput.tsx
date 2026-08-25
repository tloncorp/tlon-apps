import { useCallback, useEffect, useRef } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import { Text, View, XStack, isWeb } from 'tamagui';

import { Field } from './Field';

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
  const lastNativeTextRef = useRef('');
  const fullValue = value.join('');

  const handleChangeText = useCallback(
    (text: string) => {
      lastNativeTextRef.current = text;
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

  useEffect(() => {
    // The native input is uncontrolled (see below), so when the parent
    // resets the code externally (e.g. requesting a new one) we have to
    // clear the native text imperatively.
    if (isWeb || fullValue !== '' || lastNativeTextRef.current === '') {
      return;
    }
    lastNativeTextRef.current = '';
    inputRef.current?.clear();
  }, [fullValue]);

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
          // Echoing a controlled value back mid-IME-composition duplicates
          // the composed text on Android (stale mostRecentEventCount) —
          // worse here because the echoed value is sanitized — so native
          // stays uncontrolled; the digit boxes above render from state.
          value={isWeb ? fullValue : undefined}
          onChangeText={handleChangeText}
          keyboardType="number-pad"
          autoComplete="off"
          caretHidden={true}
          contextMenuHidden={false}
          selectionColor="transparent"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 1,
            // Use #ffffff00 instead of 'transparent' to work around
            // https://github.com/facebook/react-native/issues/53343
            // (fixed upstream by https://github.com/facebook/react-native/pull/55380, not yet merged).
            color: '#ffffff00',
            fontSize: 48,
            letterSpacing: 35,
            paddingLeft: 18,
            backgroundColor: 'transparent',
          }}
        />
      </XStack>
    </Field>
  );
}
