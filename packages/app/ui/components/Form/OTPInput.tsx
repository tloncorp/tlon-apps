import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import { Text, View, XStack, YStack, isWeb } from 'tamagui';

import { Field } from './Field';

export function OTPInput({
  length,
  value,
  mode = 'email',
  onChange,
  error,
  variant = 'default',
}: {
  length: number;
  mode: 'email' | 'phone' | 'contact';
  value: string[];
  onChange?: (value: string[]) => void;
  error?: string;
  variant?: 'default' | 'prominent';
}) {
  const inputRef = useRef<RNTextInput>(null);
  const lastNativeTextRef = useRef('');
  const [reseedKey, setReseedKey] = useState(0);
  const fullValue = value.join('');
  const isProminent = variant === 'prominent';
  const defaultContactMethod = mode === 'contact' ? 'email or phone' : mode;
  const prominentContactMethod =
    mode === 'phone' ? 'messages' : defaultContactMethod;
  const helperText = isProminent
    ? `Check your ${prominentContactMethod} for the code`
    : `Check your ${defaultContactMethod} for a confirmation code`;

  const handleChangeText = useCallback(
    (text: string) => {
      lastNativeTextRef.current = text;
      const sanitizedText = text.replace(/\D/g, '').slice(0, length);
      if (!isWeb && text !== sanitizedText) {
        // Left alone, stray characters (separators in a pasted code, typing
        // past a full code) would linger invisibly in the uncontrolled
        // native buffer and swallow backspaces. Remount the input so
        // defaultValue re-seeds the buffer with the sanitized code.
        lastNativeTextRef.current = sanitizedText;
        setReseedKey((key) => key + 1);
      }
      const nextCode = sanitizedText.split('');
      while (nextCode.length < length) {
        nextCode.push('');
      }
      onChange?.(nextCode);
    },
    [onChange, length]
  );

  useEffect(() => {
    // Runs on mount and again after a reseed remount replaces the input.
    setTimeout(() => {
      inputRef.current?.focus();
    });
  }, [reseedKey]);

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
      label={isProminent ? undefined : helperText}
      error={error}
      justifyContent="center"
      alignItems="center"
    >
      <YStack
        width={isProminent ? '100%' : undefined}
        gap={isProminent ? '$xl' : 0}
        alignItems="center"
      >
        <XStack
          gap={isProminent ? undefined : '$s'}
          width={isProminent ? '100%' : undefined}
          justifyContent={isProminent ? 'space-between' : undefined}
          position="relative"
        >
          {Array.from({ length }).map((_, i) => {
            const digit = value[i] || '';
            const isFocused = fullValue.length === i;
            return (
              <View
                key={i}
                borderWidth={1}
                borderColor={
                  isFocused
                    ? isProminent
                      ? '$primaryText'
                      : '$blue'
                    : '$border'
                }
                borderRadius={isProminent ? '$l' : '$s'}
                width={isProminent ? 54 : '$4xl'}
                height={isProminent ? 62 : '$4xl'}
                justifyContent="center"
                alignItems="center"
                backgroundColor="$background"
                pointerEvents="none"
              >
                {digit ? (
                  <Text fontSize="$2xl" fontWeight="600" color="$foreground">
                    {digit}
                  </Text>
                ) : isProminent && isFocused ? (
                  <View
                    width={2}
                    height="$2xl"
                    borderRadius="$2xs"
                    backgroundColor="$primaryText"
                  />
                ) : null}
              </View>
            );
          })}
          <RNTextInput
            ref={inputRef}
            // Remounting is the only race-free way to rewrite the uncontrolled
            // native buffer (see handleChangeText).
            key={reseedKey}
            // Echoing a controlled value back mid-IME-composition duplicates
            // the composed text on Android (stale mostRecentEventCount) —
            // worse here because the echoed value is sanitized — so native
            // stays uncontrolled; the digit boxes above render from state.
            value={isWeb ? fullValue : undefined}
            defaultValue={isWeb ? undefined : fullValue}
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
        {isProminent ? (
          <Text fontSize={14} color="$tertiaryText" textAlign="center">
            {helperText}
          </Text>
        ) : null}
      </YStack>
    </Field>
  );
}
