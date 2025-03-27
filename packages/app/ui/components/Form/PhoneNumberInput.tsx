import { isValidPhoneNumber } from 'libphonenumber-js';
import { useEffect, useRef, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { CountryPicker } from 'react-native-country-codes-picker';
import PhoneInput from 'react-native-phone-input';

import { Field, useTheme } from '../../';

export function PhoneNumberInput({
  form,
  shouldFocus = true,
}: {
  form: UseFormReturn<{ phoneNumber: string }>;
  shouldFocus?: boolean;
}) {
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const phoneInputRef = useRef<PhoneInput>(null);
  const theme = useTheme();

  useEffect(() => {
    // wait for transition to complete, then focus
    if (shouldFocus) {
      phoneInputRef.current?.focus();
    }
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
                // @ts-expect-error removes browser outline on web
                outlineStyle: 'none',
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
            padding: 16,
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
