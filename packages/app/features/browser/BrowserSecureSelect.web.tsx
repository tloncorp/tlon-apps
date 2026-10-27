import { Picker } from '@react-native-picker/picker';
import { Icon, Text, desktopTypeStyles } from '@tloncorp/ui';
import { useState } from 'react';
import { getConfig, useTheme } from 'tamagui';

import { InputFrame } from '../../ui/components/Form/inputs';
import type { BrowserSecureSelectProps } from './BrowserSecureSelect';

export function BrowserSecureSelect({
  field,
  value,
  disabled,
  onChange,
}: BrowserSecureSelectProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const selected = field.options?.find((option) => option.value === value);
  return (
    <InputFrame
      height="auto"
      minHeight={56}
      position="relative"
      borderColor={focused ? '$positiveActionText' : '$border'}
      opacity={disabled ? 0.5 : 1}
    >
      <Picker
        accessibilityLabel={field.label}
        selectedValue={value}
        enabled={!disabled}
        onValueChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          borderWidth: 0,
          backgroundColor: theme.background.val,
          color: value ? theme.primaryText.val : theme.secondaryText.val,
          fontFamily: String(getConfig().fonts.body?.family),
          fontSize: desktopTypeStyles['$label/xl'].fontSize,
          cursor: disabled ? 'auto' : 'pointer',
        }}
      >
        <Picker.Item label="Select…" value="" enabled={false} />
        {field.options?.map((option) => (
          <Picker.Item
            key={option.value}
            label={option.label}
            value={option.value}
          />
        ))}
      </Picker>
      {/* Native selects cannot wrap. Keep their menu and keyboard behavior,
          with a wrapping label so long choices remain readable on phones. */}
      <Text
        flex={1}
        minWidth={0}
        paddingVertical="$xl"
        size="$label/xl"
        trimmed={false}
        color={selected ? '$primaryText' : '$secondaryText'}
        pointerEvents="none"
        aria-hidden
      >
        {selected?.label ?? 'Select…'}
      </Text>
      <Icon
        type="ChevronDown"
        size="$m"
        color="$secondaryText"
        pointerEvents="none"
      />
    </InputFrame>
  );
}
