import {
  Host,
  SecureField,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  disabled as disable,
  font,
  foregroundStyle,
  keyboardType,
  lineLimit,
  onSubmit as submitAction,
  submitLabel,
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { InputFrame } from '../../ui/components/Form/inputs';
import { useSettingsListColors } from '../../ui/components/SettingsList/useSettingsListColors';
import { useSyncedFieldText } from '../../ui/components/SettingsList/useSyncedFieldText';
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
  const colors = useSettingsListColors();
  const text = useNativeState(value);
  const onTextChange = useSyncedFieldText(text, value, onChange);
  const multiline = field.inputType === 'textarea';
  const contentType =
    field.purpose === 'one-time-code'
      ? 'oneTimeCode'
      : field.purpose === 'username'
        ? 'username'
        : field.purpose === 'current-password'
          ? 'password'
          : undefined;
  const props = {
    text,
    onTextChange,
    maxLength: field.exactLength ?? field.maxLength,
    placeholder: field.exactLength
      ? `${field.exactLength} characters`
      : undefined,
    modifiers: [
      accessibilityLabel(browserFieldLabel(field)),
      disable(disabled),
      foregroundStyle(colors.primaryText),
      font({ size: 17 }),
      textInputAutocapitalization('never'),
      autocorrectionDisabled(),
      keyboardType(
        field.inputType === 'numeric' || field.purpose === 'cc-csc'
          ? 'numeric'
          : field.inputType === 'email'
            ? 'email-address'
            : field.inputType === 'tel'
              ? 'phone-pad'
              : 'default'
      ),
      ...(contentType ? [textContentType(contentType)] : []),
      ...(multiline
        ? [lineLimit(4, { reservesSpace: true })]
        : [submitLabel('done'), submitAction(onSubmit)]),
    ],
  };
  return (
    <InputFrame
      height={multiline ? 'auto' : 56}
      paddingVertical={multiline ? '$l' : 0}
    >
      <Host
        style={{ flex: 1 }}
        matchContents={{ vertical: true }}
        colorScheme={colors.colorScheme}
        seedColor={colors.accent}
        ignoreSafeArea="all"
      >
        {concealed ? (
          <SecureField {...props} />
        ) : (
          <TextField {...props} axis={multiline ? 'vertical' : 'horizontal'} />
        )}
      </Host>
      {rightControls}
    </InputFrame>
  );
}
