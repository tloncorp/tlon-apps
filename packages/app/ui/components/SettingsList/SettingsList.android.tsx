import {
  Box,
  Column,
  Host,
  LazyColumn,
  RNHostView,
  Row,
  Switch,
  Text,
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
  padding,
  testID,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { Icon } from '@tloncorp/ui';
import { Fragment } from 'react';
import { View } from 'react-native';

import { useTopLevelTabBarContentInset } from '../../../navigation/useTopLevelTabBarContentInset';
import { HostedSettingsRowLeading } from './SettingsRowLeading';
import type { SettingsListProps, SettingsRowModel } from './types';
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
        modifiers={[background(colors.page)]}
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
  const onClick = row.toggle
    ? () => row.toggle?.onValueChange(!row.toggle.value)
    : row.onPress;
  const onLongClick = row.contextActions?.[0]?.onPress;
  // Material shows a setting's value as the line under its title.
  const supporting = [row.subtitle, row.value].filter(Boolean).join(' · ');

  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement={{ spacedBy: 16 }}
      modifiers={[
        fillMaxWidth(),
        ...(row.disabled
          ? []
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
