import { Icon, Pressable, Text } from '@tloncorp/ui';
import { Fragment } from 'react';
import { Switch } from 'react-native';
import { XStack } from 'tamagui';

import { Badge } from '../Badge';
import { ListItem } from '../ListItem';
import { SettingsDivider, SettingsSection } from '../SettingsSection';
import { SettingsRowLeading } from './SettingsRowLeading';
import type { SettingsRowModel, SettingsSectionModel } from './types';

/**
 * Settings sections drawn with Tamagui, for web and for screens that still
 * scroll their own content. The caller supplies the scroll view and spacing.
 */
export function SettingsSectionsView({
  sections,
}: {
  sections: SettingsSectionModel[];
}) {
  return (
    <>
      {sections.map((section) => (
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
      ))}
    </>
  );
}

function SettingsRow({ row }: { row: SettingsRowModel }) {
  const isChoice = row.selected !== undefined;
  const showsChevron =
    Boolean(row.onPress) &&
    !row.toggle &&
    !row.destructive &&
    !row.action &&
    !isChoice &&
    (row.accessory ?? 'chevron') === 'chevron';
  const content = (
    <ListItem opacity={row.disabled ? 0.6 : 1}>
      <SettingsRowLeading row={row} />
      <ListItem.MainContent>
        <ListItem.Title
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
      accessibilityRole={isChoice ? 'radio' : undefined}
      accessibilityState={isChoice ? { checked: row.selected } : undefined}
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
