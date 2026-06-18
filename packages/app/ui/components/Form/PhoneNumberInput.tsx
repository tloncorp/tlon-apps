import { isValidPhoneNumber } from 'libphonenumber-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Text, TouchableOpacity, View } from 'react-native';
import { CountryPicker } from 'react-native-country-codes-picker';
import {
  TransformerTextInput,
  type TransformerTextInputInstance,
} from 'react-native-transformer-text-input';
import { PhoneNumberTransformer } from 'react-native-transformer-text-input/formatters/phone-number';
import { useTheme } from 'tamagui';

import { Field } from './Field';
import {
  detectCountryFromInput,
  getCallingCode,
  getFlag,
  toE164,
} from './phoneNumberValue';

type Props = {
  form: UseFormReturn<{ phoneNumber: string }>;
  shouldFocus?: boolean;
};

export function PhoneNumberInput({ form, shouldFocus = true }: Props) {
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [country, setCountry] = useState('US');
  const inputRef = useRef<TransformerTextInputInstance>(null);
  const theme = useTheme();

  // One international transformer: the calling code is part of the editable
  // text and the country is detected from it as the user types.
  const transformer = useMemo(
    () => new PhoneNumberTransformer({ international: true }),
    []
  );

  useEffect(() => {
    if (shouldFocus) {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Controller
        name="phoneNumber"
        control={form.control}
        rules={{
          required: 'Please enter a valid phone number.',
          validate: (value) => isValidPhoneNumber(value),
        }}
        render={({ field: { onChange } }) => (
          <Field
            width={'100%'}
            label="Phone Number"
            error={form.formState.errors.phoneNumber?.message}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: theme.border.val,
                borderRadius: 8,
                backgroundColor: theme.background.val,
                paddingHorizontal: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowCountryPicker(true)}
                style={{ paddingVertical: 16, paddingRight: 8 }}
              >
                <Text style={{ fontSize: 20 }}>{getFlag(country)}</Text>
              </TouchableOpacity>
              <TransformerTextInput
                ref={inputRef}
                transformer={transformer}
                defaultValue={`+${getCallingCode('US')} `}
                keyboardType="phone-pad"
                onChangeText={(text) => {
                  const detected = detectCountryFromInput(text);
                  if (detected) {
                    setCountry(detected);
                  }
                  onChange(toE164(text));
                }}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  color: theme.primaryText.val,
                  // @ts-expect-error removes browser outline on web
                  outlineStyle: 'none',
                }}
              />
            </View>
          </Field>
        )}
      />
      <CountryPicker
        lang="en"
        show={showCountryPicker}
        pickerButtonOnPress={(item) => {
          const next = item.code.toUpperCase();
          setCountry(next);
          const prefilled = `+${getCallingCode(next)} `;
          inputRef.current?.update({ value: prefilled, transform: true });
          form.setValue('phoneNumber', toE164(prefilled), {
            shouldValidate: false,
          });
          setShowCountryPicker(false);
        }}
        style={{
          modal: {
            flex: 0.8,
            backgroundColor: theme.background.val,
          },
          countryButtonStyles: {
            backgroundColor: theme.background.val,
          },
          dialCode: {
            color: theme.primaryText.val,
          },
          countryName: {
            color: theme.primaryText.val,
          },
          textInput: {
            backgroundColor: theme.background.val,
            color: theme.primaryText.val,
            borderWidth: 1,
            borderColor: theme.border.val,
            paddingHorizontal: 16,
          },
          line: {
            backgroundColor: theme.background.val,
          },
        }}
        onBackdropPress={() => setShowCountryPicker(false)}
      />
    </>
  );
}
