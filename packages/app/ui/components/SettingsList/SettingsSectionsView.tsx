import { Icon, Pressable, Text } from '@tloncorp/ui';
import { Fragment } from 'react';
import { Switch } from 'react-native';
import { XStack } from 'tamagui';

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
  // a toggle's goes on the switch, any other row's on the row itself.
  const unwrappedTestID = row.onPress ? undefined : row.testID;
  const content = (
    <ListItem
      opacity={row.disabled ? 0.6 : 1}
      testID={row.toggle ? undefined : unwrappedTestID}
    >
      <SettingsRowLeading row={row} />
      <ListItem.MainContent>
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
          <ListItem.Subtitle>{row.subtitle}</ListItem.Subtitle>
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
