import { Button, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { ScrollView, YStack } from 'tamagui';

import { TextInput } from '../../ui/components/Form/inputs';
import type { BrowserSecureField } from './browserCredentialHandoff';

export type BrowserSecureSelectProps = {
  field: BrowserSecureField;
  value: string;
  disabled: boolean;
  onChange(value: string): void;
};

export function BrowserSecureSelect({
  field,
  value,
  disabled,
  onChange,
}: BrowserSecureSelectProps) {
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState('');
  const options = field.options ?? [];
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase())
  );
  return (
    <YStack gap="$m">
      <Button
        accessibilityRole="button"
        focusable
        preset="outline"
        size="large"
        labelNumberOfLines={0}
        height="auto"
        minHeight={56}
        paddingVertical="$xl"
        centered={false}
        borderColor="$border"
        trailingIcon="ChevronDown"
        accessibilityLabel={field.label}
        accessibilityState={{ expanded: choosing, disabled }}
        label={
          options.find((option) => option.value === value)?.label ??
          `Choose ${field.label.toLowerCase().replace(/^choose\s+/i, '')}`
        }
        disabled={disabled}
        onPress={() => {
          setChoosing((open) => !open);
          setSearch('');
        }}
      />
      {choosing ? (
        <YStack
          borderWidth={1}
          borderColor="$border"
          borderRadius="$l"
          padding="$m"
          gap="$m"
        >
          {options.length > 12 ? (
            <TextInput
              accessibilityLabel={`Search ${field.label.toLowerCase()}`}
              value={search}
              autoComplete="off"
              autoCorrect={false}
              onChangeText={setSearch}
              placeholder="Search options"
              editable={!disabled}
            />
          ) : null}
          <ScrollView
            maxHeight={280}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <YStack>
              {filtered.map((option) => (
                <Button
                  accessibilityRole="button"
                  focusable
                  key={option.value}
                  preset="minimal"
                  size="large"
                  labelNumberOfLines={0}
                  height="auto"
                  minHeight={56}
                  paddingVertical="$xl"
                  centered={false}
                  label={option.label}
                  trailingIcon={
                    option.value === value ? 'Checkmark' : undefined
                  }
                  disabled={disabled}
                  accessibilityState={{ selected: option.value === value }}
                  onPress={() => {
                    onChange(option.value);
                    setChoosing(false);
                    setSearch('');
                  }}
                />
              ))}
              {!filtered.length ? (
                <Text color="$secondaryText" padding="$xl">
                  No matching options
                </Text>
              ) : null}
            </YStack>
          </ScrollView>
        </YStack>
      ) : null}
    </YStack>
  );
}
