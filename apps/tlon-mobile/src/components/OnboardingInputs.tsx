import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { Field, TextInput, XStack, useTheme } from '@tloncorp/ui';
import {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import {
  TextInput as RNTextInput,
  TextInputKeyPressEventData,
} from 'react-native';
import { CountryPicker } from 'react-native-country-codes-picker';
import PhoneInput from 'react-native-phone-input';

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
            paddingHorizontal="$xl"
            paddingVertical="$xl"
            width="$4xl"
            textContentType={mode === 'phone' ? 'oneTimeCode' : undefined}
          />
        ))}
      </XStack>
    </Field>
  );
}

export function PhoneNumberInput({
  form,
  shouldFocus = true,
}: {
  form: UseFormReturn<{ phoneNumber: string }>;
  shouldFocus?: boolean;
}) {
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const phoneInputRef = useRef<PhoneInput>(null);

  const isDarkMode = useIsDarkMode();
  const theme = useTheme();

  useEffect(() => {
    // wait for transition to complete, then focus
    if (shouldFocus) {
      setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 500);
    }
  }, []);

  return (
    <>
      <Controller
        name="phoneNumber"
        control={form.control}
        rules={{
          required: 'Please enter a valid phone number.',
        }}
        render={({ field: { onChange } }) => (
          <Field
            width={'100%'}
            label="Phone Number"
            error={form.formState.errors.phoneNumber?.message}
          >
            <PhoneInput
              ref={phoneInputRef}
              onPressFlag={() => setShowCountryPicker(true)}
              onChangePhoneNumber={onChange}
              style={{
                padding: 16,
                borderWidth: 1,
                borderColor: theme.border.val,
                borderRadius: 8,
                backgroundColor: theme.background.val,
              }}
              textStyle={{
                color: theme.primaryText.val,
              }}
              initialCountry="us"
              autoFormat={true}
            />
          </Field>
        )}
      />
      <CountryPicker
        lang="en"
        show={showCountryPicker}
        pickerButtonOnPress={(item) => {
          phoneInputRef.current?.selectCountry(item.code.toLowerCase());
          setShowCountryPicker(false);
        }}
        style={{
          modal: {
            flex: 0.8,
            backgroundColor: isDarkMode
              ? theme.background.val
              : theme.background.val,
          },
          countryButtonStyles: {
            backgroundColor: isDarkMode
              ? theme.background.val
              : theme.background.val,
          },
          dialCode: {
            color: theme.primaryText.val,
          },
          countryName: {
            color: theme.primaryText.val,
          },
          textInput: {
            backgroundColor: isDarkMode
              ? theme.background.val
              : theme.background.val,
            color: theme.primaryText.val,
            borderWidth: 1,
            borderColor: theme.border.val,
            padding: 16,
          },
          line: {
            backgroundColor: isDarkMode
              ? theme.background.val
              : theme.background.val,
          },
        }}
        onBackdropPress={() => setShowCountryPicker(false)}
      />
    </>
  );
}
