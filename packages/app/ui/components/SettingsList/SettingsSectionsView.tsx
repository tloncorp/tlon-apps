import { Picker } from '@react-native-picker/picker';
import { Icon, Pressable, Text, desktopTypeStyles } from '@tloncorp/ui';
import { Fragment } from 'react';
import { Switch, type TextStyle } from 'react-native';
import { XStack, getConfig, useTheme } from 'tamagui';

import { Badge } from '../Badge';
import { TextInput } from '../Form';
import { ListItem } from '../ListItem';
import { SettingsDivider, SettingsSection } from '../SettingsSection';
import { SettingsRowLeading } from './SettingsRowLeading';
import type { SettingsRowModel, SettingsSectionModel } from './types';

/**
 * Settings sections drawn with Tamagui, for the web list. The caller supplies
 * the scroll view and spacing.
 */
export function SettingsSectionsView({
  sections,
}: {
  sections: SettingsSectionModel[];
}) {
  return (
    <>
      {sections.map((section) =>
        section.element ? (
          <Fragment key={section.key}>{section.element}</Fragment>
        ) : (
          <SettingsSection
            key={section.key}
            title={section.title}
            description={section.footer}
          >
            {section.rows.map((row, index) => (
              <Fragment key={row.key}>
                {index > 0 ? <SettingsDivider /> : null}
                <SettingsRow row={row} />
              </Fragment>
            ))}
          </SettingsSection>
        )
      )}
    </>
  );
}

function SettingsRow({ row }: { row: SettingsRowModel }) {
  if (row.textField) {
    return (
      <TextInput
        // The section's card is the field's border, so the field fills the
        // row, and its text starts where the other rows' titles do.
        frameStyle={{ borderWidth: 0, paddingLeft: '$l' }}
        value={row.textField.value}
        placeholder={row.textField.placeholder}
        secureTextEntry={row.textField.secure}
        multiline={Boolean(row.textField.lines)}
        numberOfLines={row.textField.lines}
        maxLength={row.textField.maxLength}
        autoCapitalize={row.textField.capitalization ?? 'none'}
        autoCorrect={row.textField.capitalization === 'sentences'}
        aria-label={row.title}
        disabled={row.disabled}
        onChangeText={row.textField.onChangeText}
        onFocus={() => row.textField?.onFocusChange?.(true)}
        onBlur={() => row.textField?.onFocusChange?.(false)}
        onSubmitEditing={row.textField.onSubmit}
        returnKeyType={row.textField.onSubmit ? 'done' : undefined}
        testID={row.testID}
      />
    );
  }

  const isChoice = row.selected !== undefined;
  const showsChevron =
    Boolean(row.onPress) &&
    !row.toggle &&
    !row.destructive &&
    !row.action &&
    !isChoice &&
    (row.accessory ?? 'chevron') === 'chevron';
  // A row with nothing to open has no pressable wrapper to carry its test ID:
  // a toggle's goes on the switch, a picker's on its select, any other row's
  // on the row itself.
  const unwrappedTestID = row.onPress ? undefined : row.testID;
  const content = (
    <ListItem
      opacity={row.disabled ? 0.6 : 1}
      testID={row.toggle || row.picker ? undefined : unwrappedTestID}
    >
      <SettingsRowLeading row={row} />
      {/* Grows past the usual row height, so a wrapped title keeps its
          last lines and the More under it. */}
      <ListItem.MainContent
        height="auto"
        minHeight="$4xl"
        justifyContent="center"
        gap="$xs"
      >
        <ListItem.Title
          // Wraps like the native lists, unless a value shares the row.
          numberOfLines={row.expanded ? undefined : row.value ? 1 : 3}
          color={
            row.destructive
              ? '$negativeActionText'
              : row.action
                ? '$positiveActionText'
                : undefined
          }
        >
          {row.title}
        </ListItem.Title>
        {row.subtitle ? (
          <ListItem.Subtitle numberOfLines={2}>
            {row.subtitle}
          </ListItem.Subtitle>
        ) : null}
        {row.expanded === false ? (
          <ListItem.Subtitle color="$positiveActionText">
            More
          </ListItem.Subtitle>
        ) : null}
      </ListItem.MainContent>
      <XStack alignItems="center" gap="$s" flexShrink={0}>
        {row.pending ? (
          <Badge text="Pending" type="warning" size="micro" />
        ) : null}
        {row.value ? (
          <Text
            size="$label/m"
            color="$tertiaryText"
            numberOfLines={1}
            maxWidth={160}
          >
            {row.value}
          </Text>
        ) : null}
        {row.picker ? <RowPicker row={row} /> : null}
        {row.toggle ? (
          <Switch
            value={row.toggle.value}
            disabled={row.disabled}
            onValueChange={row.toggle.onValueChange}
            testID={unwrappedTestID}
          />
        ) : null}
        {row.selected ? (
          <Icon type="Checkmark" size="$m" color="$positiveActionText" />
        ) : null}
        {row.trailingAction ? (
          <Pressable
            onPress={row.trailingAction.onPress}
            testID={row.trailingAction.testID}
          >
            <Text
              size="$label/m"
              color={
                row.trailingAction.destructive
                  ? '$negativeActionText'
                  : '$positiveActionText'
              }
            >
              {row.trailingAction.title}
            </Text>
          </Pressable>
        ) : null}
        {showsChevron ? (
          <Icon type="ChevronRight" size="$m" color="$tertiaryText" />
        ) : null}
      </XStack>
    </ListItem>
  );

  if (!row.onPress) {
    return content;
  }

  return (
    <Pressable
      // Web attributes: the React Native accessibility props never reach the
      // DOM through Tamagui.
      role={isChoice ? (row.multiple ? 'checkbox' : 'radio') : undefined}
      aria-checked={isChoice ? Boolean(row.selected) : undefined}
      disabled={row.disabled}
      onPress={row.disabled ? undefined : row.onPress}
      onLongPress={row.contextActions?.[0]?.onPress}
      backgroundColor={row.isFocused ? '$secondaryBackground' : 'transparent'}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      testID={row.testID}
    >
      {content}
    </Pressable>
  );
}

// Drops the browser's own select arrow and focus ring. React Native's style
// types do not list these CSS properties; react-native-web passes them on.
const bareSelectStyle = {
  appearance: 'none',
  outlineStyle: 'none',
} as unknown as TextStyle;

/**
 * A picker row's choice, as a bare `<select>` in the value's place, with its
 * own chevron.
 */
function RowPicker({ row }: { row: SettingsRowModel }) {
  const theme = useTheme();
  const picker = row.picker!;
  return (
    <XStack alignItems="center" position="relative">
      <Picker
        accessibilityLabel={row.title}
        selectedValue={picker.value}
        onValueChange={(value) => picker.onChange(String(value))}
        testID={row.testID}
        style={[
          {
            borderWidth: 0,
            // The open list of options takes these too, so it follows the
            // app's theme rather than the system's.
            backgroundColor: theme.background.val,
            color: theme.tertiaryText.val,
            fontFamily: String(getConfig().fonts.body?.family),
            fontSize: desktopTypeStyles['$label/m'].fontSize,
            textAlign: 'right',
            // Clears the chevron.
            paddingRight: 22,
            cursor: 'pointer',
          },
          bareSelectStyle,
        ]}
      >
        {picker.options.map((option) => (
          <Picker.Item
            key={option.value}
            label={option.title}
            value={option.value}
          />
        ))}
      </Picker>
      <Icon
        type="ChevronDown"
        size="$s"
        color="$tertiaryText"
        position="absolute"
        right={0}
        pointerEvents="none"
      />
    </XStack>
  );
}
