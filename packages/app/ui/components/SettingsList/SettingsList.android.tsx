import {
  BasicTextField,
  Box,
  Column,
  Host,
  LazyColumn,
  RNHostView,
  Row,
  Switch,
  Text,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import {
  Shapes,
  alpha,
  background,
  clickable,
  clip,
  combinedClickable,
  fillMaxWidth,
  height,
  imePadding,
  padding,
  selectable,
  testID,
  toggleable,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { Icon } from '@tloncorp/ui';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { useTopLevelTabBarContentInset } from '../../../navigation/useTopLevelTabBarContentInset';
import { HostedSettingsRowLeading } from './SettingsRowLeading';
import type { SettingsListProps, SettingsRowModel } from './types';
import { useSyncedFieldText } from './useSyncedFieldText';
import {
  type SettingsListColors,
  useSettingsListColors,
} from './useSettingsListColors';

const cardShape = Shapes.RoundedCorner(16);
const pillShape = Shapes.RoundedCorner(50);

/** Settings drawn as a Compose list of grouped cards, in Tlon's theme colors. */
export function SettingsList({ sections }: SettingsListProps) {
  const colors = useSettingsListColors();
  const bottomContentInset = useTopLevelTabBarContentInset();
  // A list holding a field makes room for the keyboard itself, so the field
  // it scrolls into view ends up above the keyboard rather than behind it.
  const hasTextField = sections.some((section) =>
    section.rows.some((row) => row.textField)
  );

  return (
    <Host style={{ flex: 1 }} colorScheme={colors.colorScheme}>
      <LazyColumn
        verticalArrangement={{ spacedBy: 24 }}
        contentPadding={{
          start: 16,
          end: 16,
          top: 16,
          bottom: bottomContentInset,
        }}
        modifiers={[
          background(colors.page),
          ...(hasTextField ? [imePadding()] : []),
        ]}
      >
        {sections.map((section) => (
          <Column
            key={section.key}
            verticalArrangement={{ spacedBy: 8 }}
            modifiers={[fillMaxWidth()]}
          >
            {section.title ? (
              <Text
                color={colors.secondaryText}
                style={{ fontSize: 14, fontWeight: '500' }}
                modifiers={[padding(4, 0, 4, 0)]}
              >
                {section.title}
              </Text>
            ) : null}
            <Column
              modifiers={[
                fillMaxWidth(),
                clip(cardShape),
                background(colors.row),
              ]}
            >
              {section.rows.map((row, index) => (
                <Fragment key={row.key}>
                  {index > 0 ? (
                    <Box
                      modifiers={[
                        padding(16, 0, 0, 0),
                        fillMaxWidth(),
                        height(1),
                        background(colors.separator),
                      ]}
                    />
                  ) : null}
                  <SettingsRow row={row} colors={colors} />
                </Fragment>
              ))}
            </Column>
            {section.footer ? (
              <Text
                color={colors.secondaryText}
                style={{ fontSize: 13 }}
                modifiers={[padding(4, 0, 4, 0)]}
              >
                {section.footer}
              </Text>
            ) : null}
          </Column>
        ))}
      </LazyColumn>
    </Host>
  );
}

function SettingsRow({
  row,
  colors,
}: {
  row: SettingsRowModel;
  colors: SettingsListColors;
}) {
  if (row.textField) {
    return <TextFieldRow row={row} colors={colors} />;
  }

  const onClick = row.toggle
    ? () => row.toggle?.onValueChange(!row.toggle.value)
    : row.onPress;
  const onLongClick = row.contextActions?.[0]?.onPress;
  // Material shows a setting's value as the line under its title.
  const supporting = [row.subtitle, row.value].filter(Boolean).join(' · ');
  const isChoice = row.selected !== undefined;

  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement={{ spacedBy: 16 }}
      modifiers={[
        fillMaxWidth(),
        ...(row.disabled
          ? []
          : isChoice && onClick
            ? // The checkmark is only drawn; this is what tells TalkBack and
              // UI tests which choices are on.
              [
                row.multiple
                  ? toggleable(Boolean(row.selected), onClick, {
                      role: 'checkbox',
                    })
                  : selectable(Boolean(row.selected), onClick, 'radioButton'),
              ]
            : onLongClick
              ? [combinedClickable({ onClick, onLongClick })]
              : onClick
                ? [clickable(onClick)]
                : []),
        padding(16, row.prominent ? 16 : 12, 16, row.prominent ? 16 : 12),
        ...(row.disabled ? [alpha(0.5)] : []),
        ...(row.testID ? [testID(row.testID)] : []),
      ]}
    >
      {row.leading ? (
        <RNHostView matchContents>
          <HostedSettingsRowLeading row={row} />
        </RNHostView>
      ) : null}
      <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 2 }}>
        <Text
          color={
            row.destructive
              ? colors.negative
              : row.action
                ? colors.accent
                : colors.primaryText
          }
          style={{
            fontSize: row.prominent ? 18 : 16,
            fontWeight: row.prominent ? '600' : undefined,
          }}
        >
          {row.title}
        </Text>
        {supporting ? (
          <Text color={colors.secondaryText} style={{ fontSize: 14 }}>
            {supporting}
          </Text>
        ) : null}
      </Column>
      {row.pending ? (
        <Pill
          text="Pending"
          textColor={colors.pending.text}
          backgroundColor={colors.pending.background}
        />
      ) : null}
      {row.toggle ? (
        <Switch
          value={row.toggle.value}
          enabled={!row.disabled}
          onCheckedChange={row.toggle.onValueChange}
          colors={{
            checkedTrackColor: colors.accent,
            checkedThumbColor: colors.page,
            checkedBorderColor: colors.accent,
            uncheckedTrackColor: colors.page,
            uncheckedThumbColor: colors.tertiaryText,
            uncheckedBorderColor: colors.tertiaryText,
          }}
        />
      ) : null}
      {row.selected ? (
        <RNHostView matchContents>
          <HostedCheckmark />
        </RNHostView>
      ) : null}
    </Row>
  );
}

/**
 * A row that is its own editable field, kept in step with the screen's value.
 * Compose's plain field has no placeholder, so one sits under it while empty.
 */
function TextFieldRow({
  row,
  colors,
}: {
  row: SettingsRowModel;
  colors: SettingsListColors;
}) {
  const field = row.textField!;
  const value = useNativeState(field.value);
  // The placeholder follows the text in the field itself. The screen's value
  // can lag behind typing while it saves, and would leave the placeholder
  // drawn over what was just typed.
  const [isEmpty, setIsEmpty] = useState(field.value === '');
  const fieldState = useMemo(
    () => ({
      get: () => value.get(),
      set: (text: string) => {
        value.set(text);
        setIsEmpty(text === '');
      },
    }),
    [value]
  );
  const sendText = useSyncedFieldText(
    fieldState,
    field.value,
    field.onChangeText
  );
  const onChangeText = useCallback(
    (text: string) => {
      setIsEmpty(text === '');
      sendText(text);
    },
    [sendText]
  );

  return (
    <Box
      modifiers={[
        fillMaxWidth(),
        padding(16, 14, 16, 14),
        ...(row.disabled ? [alpha(0.5)] : []),
      ]}
    >
      {isEmpty && field.placeholder ? (
        <Text color={colors.tertiaryText} style={{ fontSize: 16 }}>
          {field.placeholder}
        </Text>
      ) : null}
      <BasicTextField
        value={value}
        onValueChange={onChangeText}
        enabled={!row.disabled}
        singleLine={!field.lines}
        minLines={field.lines}
        maxLines={field.lines}
        maxLength={field.maxLength}
        visualTransformation={field.secure ? 'password' : 'none'}
        keyboardOptions={{
          capitalization: field.capitalization ?? 'none',
          autoCorrectEnabled: field.capitalization === 'sentences',
          keyboardType: field.secure
            ? 'password'
            : field.capitalization && field.capitalization !== 'none'
              ? 'text'
              : 'uri',
          ...(field.onSubmit ? { imeAction: 'done' as const } : {}),
        }}
        keyboardActions={
          field.onSubmit ? { onDone: () => field.onSubmit?.() } : undefined
        }
        onFocusChanged={field.onFocusChange}
        textStyle={{ color: colors.primaryText, fontSize: 16 }}
        cursorColor={colors.accent}
        modifiers={[
          fillMaxWidth(),
          ...(row.testID ? [testID(row.testID)] : []),
        ]}
      />
    </Box>
  );
}

const checkmarkSize = 24;

/** Tlon's checkmark, since Compose's radio button can't take theme colors. */
function HostedCheckmark() {
  return (
    <View
      pointerEvents="none"
      style={{ width: checkmarkSize, height: checkmarkSize }}
    >
      <Icon
        type="Checkmark"
        width={checkmarkSize}
        height={checkmarkSize}
        color="$positiveActionText"
      />
    </View>
  );
}

function Pill({
  text,
  textColor,
  backgroundColor,
}: {
  text: string;
  textColor: string;
  backgroundColor: string;
}) {
  return (
    <Text
      color={textColor}
      style={{ fontSize: 12, fontWeight: '500' }}
      modifiers={[
        clip(pillShape),
        background(backgroundColor),
        padding(8, 2, 8, 2),
      ]}
    >
      {text}
    </Text>
  );
}
