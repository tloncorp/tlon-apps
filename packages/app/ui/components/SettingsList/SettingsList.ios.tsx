import {
  Button,
  ContextMenu,
  Form,
  HStack,
  Host,
  Image,
  RNHostView,
  SecureField,
  Section,
  Spacer,
  Text,
  TextField,
  Toggle,
  VStack,
  ZStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityIdentifier,
  accessibilityLabel,
  accessibilityValue,
  autocorrectionDisabled,
  background,
  createModifier,
  disabled,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listRowBackground,
  listSectionMargins,
  onSubmit as submitAction,
  padding,
  scrollContentBackground,
  shapes,
  submitLabel,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';

import { useScreenScrollProps } from '../useScreenScrollProps';
import {
  HostedSettingsRowLeading,
  getSettingsRowLeadingSize,
} from './SettingsRowLeading';
import type { SettingsListProps, SettingsRowModel } from './types';
import { useSyncedFieldText } from './useSyncedFieldText';
import {
  type SettingsListColors,
  useSettingsListColors,
} from './useSettingsListColors';

// Backported to @expo/ui 57.0.7 by patches/@expo__ui@57.0.7.patch; newer
// releases export this modifier directly.
const listRowSeparatorTint = (color: string) =>
  createModifier('listRowSeparatorTint', { color });

// SwiftUI leaves a section's worth of space (35 pt) above the first section,
// which reads as a gap under the navigation bar's small inline title.
const firstSectionModifiers = [
  listSectionMargins({ edges: 'top', length: 24 }),
];

/** Settings drawn as a SwiftUI inset-grouped form, in Tlon's theme colors. */
export function SettingsList({ sections }: SettingsListProps) {
  const colors = useSettingsListColors();
  // Keeps the transparent header the tab's other scroll views install on iOS
  // 26; the form scrolls beneath it, and iOS gives it the soft edge on its own.
  useScreenScrollProps();

  return (
    <Host style={{ flex: 1 }} colorScheme={colors.colorScheme}>
      <Form
        // SwiftUI keeps a row's separator tint from when it was first drawn, so
        // a theme change would leave the old color; rebuild the form instead.
        key={colors.separator}
        modifiers={[scrollContentBackground('hidden'), background(colors.page)]}
      >
        {sections.map((section, index) => (
          <Section
            key={section.key}
            modifiers={index === 0 ? firstSectionModifiers : undefined}
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
    listRowSeparatorTint(colors.separator),
    disabled(Boolean(row.disabled)),
    ...(row.testID ? [accessibilityIdentifier(row.testID)] : []),
  ];

  if (row.textField) {
    return <TextFieldRow row={row} modifiers={rowModifiers} />;
  }

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

  if (row.action) {
    return (
      <Button onPress={row.onPress} modifiers={rowModifiers}>
        <Text modifiers={[foregroundStyle(colors.accent)]}>{row.title}</Text>
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
    ...(row.selected ? [accessibilityAddTraits(['isSelected'])] : []),
  ];
  // A choice shows its checkmark instead of an accessory.
  const accessory = !row.onPress
    ? 'none'
    : row.selected !== undefined
      ? 'none'
      : (row.accessory ?? 'chevron');
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
      {row.value ? (
        <Text modifiers={[foregroundStyle(colors.secondaryText), lineLimit(1)]}>
          {row.value}
        </Text>
      ) : null}
      {row.selected ? (
        <Image systemName="checkmark" size={15} color={colors.accent} />
      ) : null}
      {accessory === 'external' ? (
        <Image
          systemName="arrow.up.right"
          size={13}
          color={colors.tertiaryText}
        />
      ) : accessory === 'chevron' ? (
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

/** A row that is its own editable field, kept in step with the screen's value. */
function TextFieldRow({
  row,
  modifiers,
}: {
  row: SettingsRowModel;
  modifiers: ReturnType<typeof listRowBackground>[];
}) {
  const field = row.textField!;
  const text = useNativeState(field.value);
  const onChangeText = useSyncedFieldText(
    text,
    field.value,
    field.onChangeText
  );

  const fieldProps = {
    text,
    placeholder: field.placeholder,
    maxLength: field.maxLength,
    onTextChange: onChangeText,
    onFocusChange: field.onFocusChange,
    modifiers: [
      ...modifiers,
      ...(field.lines ? [lineLimit(field.lines, { reservesSpace: true })] : []),
      accessibilityLabel(row.title),
      textInputAutocapitalization(
        field.capitalization === 'words' || field.capitalization === 'sentences'
          ? field.capitalization
          : 'never'
      ),
      autocorrectionDisabled(field.capitalization !== 'sentences'),
      ...(field.onSubmit
        ? [submitLabel('done'), submitAction(field.onSubmit)]
        : []),
    ],
  };
  return field.secure ? (
    <SecureField {...fieldProps} />
  ) : (
    <TextField {...fieldProps} axis={field.lines ? 'vertical' : undefined} />
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
      {row.leading ? <RowLeading row={row} /> : null}
      <VStack alignment="leading" spacing={2}>
        <Text
          modifiers={[
            foregroundStyle(colors.primaryText),
            ...(row.prominent ? [font({ size: 19, weight: 'semibold' })] : []),
            lineLimit(titleLineLimit(row)),
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
      {/* Other rows show it beside their value; a toggle has no value slot. */}
      {row.toggle && row.pending ? (
        <Pill
          text="Pending"
          textColor={colors.pending.text}
          backgroundColor={colors.pending.background}
        />
      ) : null}
    </HStack>
  );
}

/**
 * SwiftUI reserves the leading slot at a fixed size and the hosted view fills
 * it. `matchContents` would size the slot from the hosted view instead, but a
 * form row laid out before that view mounts gets a zero-width slot and keeps
 * it, which leaves the icon drawn over the title.
 */
function RowLeading({ row }: { row: SettingsRowModel }) {
  const size = getSettingsRowLeadingSize(row, true);
  return (
    <ZStack modifiers={[frame({ width: size, height: size })]}>
      <RNHostView>
        <HostedSettingsRowLeading row={row} />
      </RNHostView>
    </ZStack>
  );
}

/**
 * Long titles, such as a feature flag's description, wrap; a title beside a
 * value keeps to one line so the value keeps its room.
 */
function titleLineLimit(row: SettingsRowModel) {
  return row.value ? 1 : 3;
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
