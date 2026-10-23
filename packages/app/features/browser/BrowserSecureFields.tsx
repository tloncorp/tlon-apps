import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { TextInput } from '../../ui/components/Form/inputs';
import type { BrowserSecureField } from './browserCredentialHandoff';
import { BrowserSecureSelect } from './BrowserSecureSelect';
import {
  browserFieldLabel,
  browserFieldSections,
} from './browserFormPresentation';

function SecureField({
  field,
  value,
  disabled,
  onChange,
  onSubmit,
}: {
  field: BrowserSecureField;
  value: string;
  disabled: boolean;
  onChange(value: string): void;
  onSubmit(): void;
}) {
  const [visible, setVisible] = useState(false);
  const options = field.options;
  const yesNo =
    options?.length === 2 &&
    options.every((option) => /^(yes|no)$/i.test(option.label.trim()));
  const password = field.inputType === 'password';
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
    <YStack gap="$m" flex={1} minWidth={0} $gtSm={{ flexBasis: 0 }}>
      <XStack gap="$s" alignItems="baseline" flexWrap="wrap">
        <Text size="$label/l" color="$primaryText">
          {browserFieldLabel(field)}
        </Text>
        {!field.required ? (
          <Text size="$label/m" color="$secondaryText">
            Optional
          </Text>
        ) : null}
      </XStack>
      {yesNo ? (
        <XStack gap="$m">
          {options.map((option) => (
            <Button
              role="button"
              tabIndex={disabled ? -1 : 0}
              onKeyDown={
                isWeb
                  ? (event) => {
                      if (
                        !disabled &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault();
                        onChange(option.value);
                      }
                    }
                  : undefined
              }
              accessibilityRole="button"
              focusable
              key={option.value}
              label={option.label}
              preset={option.value === value ? 'primary' : 'outline'}
              borderColor={option.value === value ? '$primaryText' : '$border'}
              centered
              flex={1}
              minHeight={44}
              disabled={disabled}
              aria-label={`${browserFieldLabel(field)}: ${option.label}`}
              aria-pressed={option.value === value}
              accessibilityLabel={`${browserFieldLabel(field)}: ${option.label}`}
              accessibilityState={{ selected: option.value === value }}
              onPress={() => onChange(option.value)}
            />
          ))}
        </XStack>
      ) : options ? (
        <BrowserSecureSelect
          field={{ ...field, label: browserFieldLabel(field) }}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      ) : (
        <XStack alignItems="center" gap="$m">
          <View flex={1}>
            <TextInput
              accessibilityLabel={browserFieldLabel(field)}
              value={value}
              secureTextEntry={password && !visible}
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
                field.exactLength
                  ? `${field.exactLength} characters`
                  : undefined
              }
              editable={!disabled}
              onChangeText={onChange}
              onSubmitEditing={
                field.inputType === 'textarea' ? undefined : onSubmit
              }
            />
          </View>
          {password ? (
            <Pressable
              render={isWeb ? 'button' : undefined}
              aria-label={`${visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`}
              accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`}
              accessibilityRole="button"
              width={44}
              height={44}
              padding={0}
              borderWidth={0}
              backgroundColor="transparent"
              borderRadius="$m"
              hoverStyle={{ backgroundColor: '$secondaryBackground' }}
              alignItems="center"
              justifyContent="center"
              disabled={disabled}
              onPress={() => setVisible((shown) => !shown)}
            >
              <Icon
                type={visible ? 'EyeClosed' : 'EyeOpen'}
                size="$m"
                color="$secondaryText"
              />
            </Pressable>
          ) : null}
        </XStack>
      )}
    </YStack>
  );
}

export function BrowserSecureFields({
  fields,
  formId,
  values,
  disabled,
  showSections,
  onChange,
  onSubmit,
}: {
  fields: BrowserSecureField[];
  formId: string;
  values: Record<string, string>;
  disabled: boolean;
  showSections: boolean;
  onChange(id: string, value: string): void;
  onSubmit(): void;
}) {
  const sections = showSections
    ? browserFieldSections(fields)
    : [{ title: '', fields }];
  return (
    <YStack gap="$3xl">
      {sections.map((section) => (
        <YStack key={section.fields[0].id} gap="$xl">
          {showSections &&
          (sections.length > 1 || section.title !== 'Details') ? (
            <Text size="$label/2xl" fontWeight="600" accessibilityRole="header">
              {section.title}
            </Text>
          ) : null}
          {fieldRows(section.fields).map((row) => (
            <XStack
              key={row[0].id}
              gap="$xl"
              flexDirection="column"
              $gtSm={{ flexDirection: 'row' }}
            >
              {row.map((field) => (
                <SecureField
                  key={`${formId}:${field.id}`}
                  field={field}
                  value={values[field.id] ?? ''}
                  disabled={disabled}
                  onChange={(value) => onChange(field.id, value)}
                  onSubmit={onSubmit}
                />
              ))}
            </XStack>
          ))}
        </YStack>
      ))}
    </YStack>
  );
}

function fieldRows(fields: BrowserSecureField[]) {
  const rows: BrowserSecureField[][] = [];
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    const next = fields[index + 1];
    const third = fields[index + 2];
    if (
      next &&
      third &&
      /^city$/i.test(field.label) &&
      /^state$/i.test(next.label) &&
      /^zip code$/i.test(third.label)
    ) {
      rows.push([field, next, third]);
      index += 2;
      continue;
    }
    const pair =
      next &&
      ((/^first name$/i.test(field.label) && /^last name$/i.test(next.label)) ||
        (/^expiration date/i.test(field.label) &&
          /^security code/i.test(next.label)));
    rows.push(pair ? [field, fields[++index]] : [field]);
  }
  return rows;
}
