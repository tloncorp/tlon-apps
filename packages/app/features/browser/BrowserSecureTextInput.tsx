import { isWeb } from 'tamagui';
import { TextInput } from '../../ui/components/Form/inputs';
import { browserFieldLabel } from './browserFormPresentation';
import type { BrowserSecureTextInputProps } from './browserSecureTextInputProps';

export function BrowserSecureTextInput({
  field,
  value,
  disabled,
  concealed,
  rightControls,
  onChange,
  onSubmit,
}: BrowserSecureTextInputProps) {
  const autocomplete =
    field.purpose === 'one-time-code'
      ? 'one-time-code'
      : isWeb
        ? 'off'
        : field.purpose === 'username'
          ? 'username'
          : field.purpose === 'current-password'
            ? 'current-password'
            : 'off';
  return (
    <TextInput
      rightControls={rightControls}
      accessibilityLabel={browserFieldLabel(field)}
      value={value}
      secureTextEntry={concealed}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={autocomplete}
      importantForAutofill={autocomplete === 'off' ? 'no' : 'yes'}
      textContentType={
        autocomplete === 'one-time-code'
          ? 'oneTimeCode'
          : autocomplete === 'username'
            ? 'username'
            : autocomplete === 'current-password'
              ? 'password'
              : 'none'
      }
      keyboardType={
        field.inputType === 'numeric' || field.purpose === 'cc-csc'
          ? 'number-pad'
          : field.inputType === 'email'
            ? 'email-address'
            : field.inputType === 'tel'
              ? 'phone-pad'
              : 'default'
      }
      multiline={field.inputType === 'textarea'}
      maxLength={field.exactLength ?? field.maxLength}
      placeholder={
        field.exactLength ? `${field.exactLength} characters` : undefined
      }
      editable={!disabled}
      onChangeText={onChange}
      onSubmitEditing={field.inputType === 'textarea' ? undefined : onSubmit}
    />
  );
}
