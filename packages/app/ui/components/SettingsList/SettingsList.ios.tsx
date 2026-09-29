import {
  Button,
  ContextMenu,
  Form,
  HStack,
  Host,
  Image,
  RNHostView,
  Section,
  Spacer,
  Text,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  accessibilityLabel,
  accessibilityValue,
  background,
  disabled,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listRowBackground,
  padding,
  scrollContentBackground,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import { useScreenScrollProps } from '../useScreenScrollProps';
import { HostedSettingsRowLeading } from './SettingsRowLeading';
import type { SettingsListProps, SettingsRowModel } from './types';
import {
  type SettingsListColors,
  useSettingsListColors,
} from './useSettingsListColors';

/** Settings drawn as a SwiftUI inset-grouped form, in Tlon's theme colors. */
export function SettingsList({ sections }: SettingsListProps) {
  const colors = useSettingsListColors();
  // Keeps the transparent header and scroll-edge treatment the tab's other
  // scroll views install on iOS 26; the form scrolls beneath it.
  useScreenScrollProps();

  return (
    <Host style={{ flex: 1 }} colorScheme={colors.colorScheme}>
      <Form
        modifiers={[scrollContentBackground('hidden'), background(colors.page)]}
      >
        {sections.map((section) => (
          <Section
            key={section.key}
            header={
              section.title ? (
                <Text modifiers={[foregroundStyle(colors.secondaryText)]}>
                  {section.title}
                </Text>
              ) : undefined
            }
            footer={
              section.footer ? (
                <Text modifiers={[foregroundStyle(colors.secondaryText)]}>
                  {section.footer}
                </Text>
              ) : undefined
            }
          >
            {section.rows.map((row) => (
              <SettingsRow key={row.key} row={row} colors={colors} />
            ))}
          </Section>
        ))}
      </Form>
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
  const rowModifiers = [
    listRowBackground(colors.row),
    disabled(Boolean(row.disabled)),
    ...(row.testID ? [accessibilityIdentifier(row.testID)] : []),
  ];

  if (row.toggle) {
    return (
      <Toggle
        isOn={row.toggle.value}
        onIsOnChange={row.toggle.onValueChange}
        modifiers={rowModifiers}
      >
        <RowLabel row={row} colors={colors} />
      </Toggle>
    );
  }

  if (row.destructive) {
    return (
      <Button role="destructive" onPress={row.onPress} modifiers={rowModifiers}>
        <Text
          modifiers={[
            foregroundStyle(colors.negative),
            frame({ maxWidth: Infinity, alignment: 'center' }),
          ]}
        >
          {row.title}
        </Text>
      </Button>
    );
  }

  const labelledRowModifiers = [
    ...rowModifiers,
    // One label and value, so text matching and VoiceOver read the title
    // alone rather than every text in the row run together.
    accessibilityLabel(row.title),
    ...(row.value || row.subtitle
      ? [accessibilityValue((row.value ?? row.subtitle) as string)]
      : []),
  ];
  const content = (
    <HStack
      spacing={8}
      // A row with nothing to open is plain content, not a button.
      modifiers={row.onPress ? undefined : labelledRowModifiers}
    >
      <RowLabel row={row} colors={colors} />
      <Spacer />
      {row.pending ? (
        <Pill
          text="Pending"
          textColor={colors.pending.text}
          backgroundColor={colors.pending.background}
        />
      ) : null}
      {row.status ? (
        <Pill
          text={row.status.text}
          textColor={colors.status[row.status.tone].text}
          backgroundColor={colors.status[row.status.tone].background}
        />
      ) : null}
      {row.value ? (
        <Text modifiers={[foregroundStyle(colors.secondaryText), lineLimit(1)]}>
          {row.value}
        </Text>
      ) : null}
      {row.external ? (
        <Image
          systemName="arrow.up.right"
          size={13}
          color={colors.tertiaryText}
        />
      ) : row.onPress ? (
        <Image
          systemName="chevron.right"
          size={13}
          color={colors.tertiaryText}
        />
      ) : null}
    </HStack>
  );

  if (!row.onPress) {
    return content;
  }

  const button = (
    <Button onPress={row.onPress} modifiers={labelledRowModifiers}>
      {content}
    </Button>
  );

  if (!row.contextActions?.length) {
    return button;
  }

  return (
    <ContextMenu>
      <ContextMenu.Items>
        {row.contextActions.map((action) => (
          <Button
            key={action.key}
            label={action.title}
            onPress={action.onPress}
          />
        ))}
      </ContextMenu.Items>
      <ContextMenu.Trigger>{button}</ContextMenu.Trigger>
    </ContextMenu>
  );
}

function RowLabel({
  row,
  colors,
}: {
  row: SettingsRowModel;
  colors: SettingsListColors;
}) {
  return (
    <HStack spacing={12}>
      {row.leading ? (
        <RNHostView matchContents>
          <HostedSettingsRowLeading row={row} />
        </RNHostView>
      ) : null}
      <VStack alignment="leading" spacing={2}>
        <Text
          modifiers={[
            foregroundStyle(colors.primaryText),
            ...(row.prominent ? [font({ size: 19, weight: 'semibold' })] : []),
            lineLimit(1),
          ]}
        >
          {row.title}
        </Text>
        {row.subtitle ? (
          <Text
            modifiers={[
              font({ size: 13 }),
              foregroundStyle(colors.secondaryText),
              lineLimit(row.toggle ? 3 : 1),
            ]}
          >
            {row.subtitle}
          </Text>
        ) : null}
      </VStack>
    </HStack>
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
      modifiers={[
        font({ size: 12, weight: 'medium' }),
        foregroundStyle(textColor),
        padding({ horizontal: 8, vertical: 3 }),
        background(backgroundColor, shapes.capsule()),
      ]}
    >
      {text}
    </Text>
  );
}
