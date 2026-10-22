import {
  BasicTextField,
  Box,
  Checkbox,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Host,
  HorizontalDivider,
  LazyColumn,
  RNHostView,
  RadioButton,
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
  imePadding,
  padding,
  selectable,
  semantics,
  testID,
  toggleable,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useTopLevelTabBarClearance,
  useTopLevelTabBarContentInset,
} from '../../../navigation/useTopLevelTabBarContentInset';
import { HostedSettingsRowLeading } from './SettingsRowLeading';
import type { SettingsListProps, SettingsRowModel } from './types';
import { useSyncedFieldText } from './useSyncedFieldText';
import {
  type SettingsListColors,
  useSettingsListColors,
} from './useSettingsListColors';

const listSidePadding = 16;
const cardShape = Shapes.RoundedCorner(16);
const pillShape = Shapes.RoundedCorner(50);

/** Settings drawn as a Compose list of grouped cards, in Tlon's theme colors. */
export function SettingsList({ sections }: SettingsListProps) {
  const colors = useSettingsListColors();
  const bottomContentInset = useTopLevelTabBarContentInset();
  // A pushed screen's list runs to the bottom of the window, under the system
  // navigation bar, so its last rows must stop above that bar. The tab bar's
  // clearance already allows for it.
  const onTabScreen = useTopLevelTabBarClearance() > 0;
  const { bottom: systemBarInset } = useSafeAreaInsets();
  // A hosted section is otherwise only as wide as its own content. It gets the
  // list's full width, as on iOS, and Compose centers anything wider than
  // the padded column, so the section runs edge to edge and lays out its own
  // margins. Expo UI keeps the first layout of hosted text, so the width is
  // known from the first render (the window's, corrected by the list's own
  // layout), and a change remounts the section rather than leaving text laid
  // out for no width or an old one.
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width),
    []
  );

  return (
    <View style={{ flex: 1 }} onLayout={handleLayout}>
      <Host style={{ flex: 1 }} colorScheme={colors.colorScheme}>
        <LazyColumn
          verticalArrangement={{ spacedBy: 24 }}
          contentPadding={{
            start: listSidePadding,
            end: listSidePadding,
            top: 16,
            bottom: bottomContentInset + (onTabScreen ? 0 : systemBarInset),
          }}
          // The list makes room for the keyboard itself, so a field it scrolls
          // into view, or the results of a search from the navigation bar, end up
          // above the keyboard rather than behind it.
          modifiers={[background(colors.page), imePadding()]}
        >
          {sections.map((section) =>
            section.element ? (
              <RNHostView key={`${section.key}:${width}`} matchContents>
                <View style={{ width }}>{section.element}</View>
              </RNHostView>
            ) : (
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
                  {section.rows.map((row, index, rows) => (
                    <Fragment key={row.key}>
                      {index > 0 ? (
                        <HorizontalDivider
                          thickness={1}
                          color={colors.separator}
                          modifiers={[padding(16, 0, 0, 0)]}
                        />
                      ) : null}
                      <SettingsRow
                        row={row}
                        colors={colors}
                        valueTrails={valuesTrail(rows)}
                      />
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
            )
          )}
        </LazyColumn>
      </Host>
    </View>
  );
}

/**
 * Material shows a setting's value as the line under its title. Once a row in
 * a card already has a line there, like a role and its description, every row
 * in that card ends with its value instead, so the card reads one way.
 */
function valuesTrail(rows: SettingsRowModel[]) {
  return rows.some(
    (row) => row.subtitle && (row.value !== undefined || row.picker)
  );
}

function SettingsRow({
  row,
  colors,
  valueTrails,
}: {
  row: SettingsRowModel;
  colors: SettingsListColors;
  valueTrails: boolean;
}) {
  if (row.textField) {
    return <TextFieldRow row={row} colors={colors} />;
  }
  return <PlainRow row={row} colors={colors} valueTrails={valueTrails} />;
}

function PlainRow({
  row,
  colors,
  valueTrails,
}: {
  row: SettingsRowModel;
  colors: SettingsListColors;
  valueTrails: boolean;
}) {
  // Long-press actions, or a picker's choices on a tap, open a menu anchored
  // to the row.
  const [menuOpen, setMenuOpen] = useState(false);
  const picker = row.picker;
  const actions = row.contextActions ?? [];
  const onClick = picker
    ? () => setMenuOpen(true)
    : row.toggle
      ? () => row.toggle?.onValueChange(!row.toggle.value)
      : row.onPress;
  const onLongClick = actions.length ? () => setMenuOpen(true) : undefined;
  const pickedTitle = picker?.options.find(
    (option) => option.value === picker.value
  )?.title;
  const value = row.value ?? pickedTitle;
  const supporting = valueTrails ? row.subtitle : (row.subtitle ?? value);
  const trailingValue = valueTrails ? value : undefined;
  const isChoice = row.selected !== undefined;

  const content = (
    <Row
      verticalAlignment="center"
      horizontalArrangement={{ spacedBy: 16 }}
      modifiers={[
        fillMaxWidth(),
        ...(row.disabled
          ? []
          : isChoice && onClick
            ? // The row takes the tap, not its radio button or checkbox, as in
              // Material's own lists; this is also what tells TalkBack and UI
              // tests which choices are on.
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
      {/* One choice of several leads with a radio button, the way Android's
          own settings lists draw it. */}
      {isChoice && !row.multiple ? (
        <RadioButton
          selected={Boolean(row.selected)}
          colors={{
            selectedColor: colors.accent,
            unselectedColor: colors.tertiaryText,
          }}
        />
      ) : null}
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
          // Labels run as long as they need to; only prose is ever cut off.
          maxLines={row.expanded === false ? 3 : undefined}
          overflow="ellipsis"
        >
          {row.title}
        </Text>
        {supporting ? (
          <Text color={colors.secondaryText} style={{ fontSize: 14 }}>
            {supporting}
          </Text>
        ) : null}
        {row.expanded === false ? (
          <Text color={colors.accent} style={{ fontSize: 16 }}>
            More
          </Text>
        ) : null}
      </Column>
      {trailingValue ? (
        <Text color={colors.secondaryText} style={{ fontSize: 16 }}>
          {trailingValue}
        </Text>
      ) : null}
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
      {/* Any number of choices end with a checkbox, after the person or
          thing they pick. */}
      {isChoice && row.multiple ? (
        <Checkbox
          value={Boolean(row.selected)}
          colors={{
            checkedColor: colors.accent,
            uncheckedColor: colors.tertiaryText,
            checkmarkColor: colors.row,
          }}
        />
      ) : null}
      {row.trailingAction ? (
        <Text
          color={
            row.trailingAction.destructive ? colors.negative : colors.accent
          }
          style={{ fontSize: 16 }}
          modifiers={[
            // A disabled row's button is off with it, as SwiftUI's is.
            ...(row.disabled ? [] : [clickable(row.trailingAction.onPress)]),
            padding(8, 4, 0, 4),
            ...(row.trailingAction.testID
              ? [testID(row.trailingAction.testID)]
              : []),
          ]}
        >
          {row.trailingAction.title}
        </Text>
      ) : null}
    </Row>
  );

  // Both menus keep Material's own surface and shadow, as Google's apps draw
  // them, in the app's light or dark theme from the list's Host.
  if (picker) {
    return (
      <DropdownMenu
        expanded={menuOpen}
        onDismissRequest={() => setMenuOpen(false)}
      >
        <DropdownMenu.Trigger>{content}</DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {picker.options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                setMenuOpen(false);
                picker.onChange(option.value);
              }}
            >
              <DropdownMenuItem.Text>
                <Text
                  color={
                    option.value === picker.value
                      ? colors.accent
                      : colors.primaryText
                  }
                >
                  {option.title}
                </Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    );
  }

  if (!actions.length) {
    return content;
  }

  return (
    <DropdownMenu
      expanded={menuOpen}
      onDismissRequest={() => setMenuOpen(false)}
    >
      <DropdownMenu.Trigger>{content}</DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            onClick={() => {
              setMenuOpen(false);
              action.onPress();
            }}
          >
            <DropdownMenuItem.Text>
              <Text>{action.title}</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
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
      {/* Stays mounted and only empties, since adding or removing a view
          ahead of the field remounts the field, which drops focus and closes
          the keyboard after the first letter typed into an empty field. */}
      {field.placeholder ? (
        <Text color={colors.tertiaryText} style={{ fontSize: 16 }}>
          {isEmpty ? field.placeholder : ''}
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
          // The title isn't drawn on a field row, so this is all TalkBack has
          // to say what the field is for.
          semantics({ contentDescription: row.title }),
          ...(row.testID ? [testID(row.testID)] : []),
        ]}
      />
    </Box>
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
