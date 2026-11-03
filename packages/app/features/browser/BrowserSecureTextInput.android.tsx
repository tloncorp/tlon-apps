import {
  BasicTextField,
  Box,
  Host,
  Text,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics } from '@expo/ui/jetpack-compose/modifiers';
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
  const onValueChange = useSyncedFieldText(text, value, onChange);
  const multiline = field.inputType === 'textarea';
  return (
    <InputFrame
      height={multiline ? 'auto' : 56}
      paddingVertical={multiline ? '$l' : 0}
    >
      <Host
        style={{ flex: 1 }}
        matchContents={{ vertical: true }}
        colorScheme={colors.colorScheme}
        ignoreSafeAreaKeyboardInsets
      >
        <BasicTextField
          value={text}
          onValueChange={onValueChange}
          enabled={!disabled}
          singleLine={!multiline}
          minLines={multiline ? 4 : 1}
          maxLength={field.exactLength ?? field.maxLength}
          visualTransformation={concealed ? 'password' : 'none'}
          keyboardOptions={{
            capitalization: 'none',
            autoCorrectEnabled: false,
            keyboardType:
              field.inputType === 'numeric' || field.purpose === 'cc-csc'
                ? 'number'
                : field.inputType === 'email'
                  ? 'email'
                  : field.inputType === 'tel'
                    ? 'phone'
                    : field.inputType === 'password'
                      ? 'password'
                      : 'text',
            imeAction: multiline ? 'default' : 'done',
          }}
          keyboardActions={multiline ? undefined : { onDone: onSubmit }}
          textStyle={{ color: colors.primaryText, fontSize: 16 }}
          cursorColor={colors.accent}
          modifiers={[
            fillMaxWidth(),
            semantics({
              contentDescription: browserFieldLabel(field),
              contentType:
                field.purpose === 'one-time-code'
                  ? 'one-time-code'
                  : field.purpose === 'username'
                    ? 'username'
                    : field.purpose === 'current-password'
                      ? 'password'
                      : undefined,
            }),
          ]}
        >
          <BasicTextField.DecorationBox>
            <Box>
              <BasicTextField.Placeholder>
                <Text color={colors.tertiaryText} style={{ fontSize: 16 }}>
                  {field.exactLength ? `${field.exactLength} characters` : ''}
                </Text>
              </BasicTextField.Placeholder>
              <BasicTextField.InnerTextField />
            </Box>
          </BasicTextField.DecorationBox>
        </BasicTextField>
      </Host>
      {rightControls}
    </InputFrame>
  );
}
