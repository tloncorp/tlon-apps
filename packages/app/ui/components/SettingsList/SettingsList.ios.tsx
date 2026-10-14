import {
  Button,
  ContextMenu,
  Form,
  HStack,
  Host,
  Image,
  List,
  Menu,
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
  deleteDisabled,
  disabled,
  environment,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listRowBackground,
  listRowInsets,
  listRowSeparatorTint,
  listSectionMargins,
  onSubmit as submitAction,
  opacity,
  padding,
  scrollContentBackground,
  shapes,
  submitLabel,
  textInputAutocapitalization,
  useScrollGeometryChange,
} from '@expo/ui/swift-ui/modifiers';

import {
  type ComponentProps,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { View, useWindowDimensions } from 'react-native';

import { useFloatingHeaderHeight } from '../../../navigation/useFloatingHeaderHeight';
import { useScreenScrollProps } from '../useScreenScrollProps';
import {
  HostedSettingsRowLeading,
  getSettingsRowLeadingSize,
} from './SettingsRowLeading';
import type {
  SettingsListProps,
  SettingsListScrollMark,
  SettingsMenuItem,
  SettingsRowModel,
} from './types';
import { useSyncedFieldText } from './useSyncedFieldText';
import {
  type SettingsListColors,
  useSettingsListColors,
} from './useSettingsListColors';

// SwiftUI leaves a section's worth of space (35 pt) above the first section,
// which reads as a gap under the navigation bar's small inline title.
const firstSectionModifiers = [
  listSectionMargins({ edges: 'top', length: 24 }),
];

// A screen's own content at the top sits right under the navigation bar.
const flushFirstSectionModifiers = [
  listSectionMargins({ edges: 'top', length: 0 }),
];

/** Settings drawn as a SwiftUI inset-grouped form, in Tlon's theme colors. */
export function SettingsList({
  sections,
  scrollMark,
  editing,
}: SettingsListProps) {
  const colors = useSettingsListColors();
  const scrollMarkModifier = useScrollMark(scrollMark);
  // Keeps the transparent header the tab's other scroll views install on iOS
  // 26; the form scrolls beneath it, and iOS gives it the soft edge on its own.
  useScreenScrollProps();

  return (
    <Host style={{ flex: 1 }} colorScheme={colors.colorScheme}>
      <Form
        // SwiftUI keeps a row's separator tint from when it was first drawn, so
        // a theme change would leave the old color; rebuild the form instead.
        key={colors.separator}
        modifiers={[
          ...(scrollMarkModifier ? [scrollMarkModifier] : []),
          ...(editing === undefined
            ? []
            : [environment('editMode', editing ? 'active' : 'inactive')]),
          scrollContentBackground('hidden'),
          background(colors.page),
        ]}
      >
        {sections.map((section, index) => (
          <Section
            key={section.key}
            modifiers={
              index !== 0
                ? undefined
                : section.element
                  ? flushFirstSectionModifiers
                  : firstSectionModifiers
            }
            header={
              section.element ? (
                <HostedSectionElement element={section.element} />
              ) : section.title && section.titleMenu?.length ? (
                <HStack>
                  <Text modifiers={[foregroundStyle(colors.secondaryText)]}>
                    {section.title}
                  </Text>
                  <Spacer />
                  <Menu
                    label={
                      <Image
                        systemName="ellipsis.circle"
                        size={17}
                        color={colors.accent}
                      />
                    }
                    modifiers={[accessibilityLabel(`${section.title} options`)]}
                  >
                    <MenuItems items={section.titleMenu} />
                  </Menu>
                </HStack>
              ) : section.title ? (
                <Text modifiers={[foregroundStyle(colors.secondaryText)]}>
                  {section.title}
                </Text>
              ) : undefined
            }
            footer={
              section.footer ? (
                <Text modifiers={footerModifiers(colors)}>
                  {section.footer}
                </Text>
              ) : undefined
            }
          >
            {section.onMove ? (
              <List.ForEach onMove={section.onMove}>
                {section.rows.map((row) => (
                  <SettingsRow
                    key={row.key}
                    row={row}
                    colors={colors}
                    reorderable
                  />
                ))}
              </List.ForEach>
            ) : (
              section.rows.map((row) => (
                <SettingsRow key={row.key} row={row} colors={colors} />
              ))
            )}
          </Section>
        ))}
      </Form>
    </Host>
  );
}

/**
 * Tells a screen when the list crosses its scroll mark, in either direction.
 * Under a floating bar the list rests at minus the bar's height, so distance
 * is counted from there.
 */
function useScrollMark(mark?: SettingsListScrollMark) {
  const latest = useRef(mark);
  useEffect(() => {
    latest.current = mark;
  }, [mark]);
  const restOffset = -useFloatingHeaderHeight();
  const hasRested = useRef(false);
  const isPast = useRef(false);
  const onGeometry = useCallback(
    ({ contentOffsetY }: { contentOffsetY: number }) => {
      const current = latest.current;
      if (!current) {
        return;
      }
      // The list reports an offset of zero before the bar's inset is applied,
      // which would read as already scrolled.
      if (!hasRested.current) {
        if (contentOffsetY > restOffset + 1) {
          return;
        }
        hasRested.current = true;
      }
      const past = contentOffsetY - restOffset > current.offset;
      if (past !== isPast.current) {
        isPast.current = past;
        current.onCrossed(past);
      }
    },
    [restOffset]
  );
  return useScrollGeometryChange(mark ? onGeometry : undefined);
}

/**
 * A footer otherwise sits closer to the next section's heading than to its
 * own card, so it reads as that heading's caption. The extra space below it
 * matches the gap a section without a footer leaves.
 */
function footerModifiers(colors: SettingsListColors) {
  return [foregroundStyle(colors.secondaryText), padding({ bottom: 10 })];
}

/** The margin an inset-grouped form keeps on each side of its rows. */
const formSideMargin = 16;

// A section's header is the one part of the form that isn't clipped to a
// card, so negative side insets carry it out to the screen's edges. The
// content then decides its own margins and can scroll sideways edge to edge.
const hostedElementModifiers = [
  listRowInsets({
    top: 0,
    leading: -formSideMargin,
    bottom: 0,
    trailing: -formSideMargin,
  }),
];

/**
 * A section's own React Native content, hosted as the section's header. The
 * hosted view is given the screen's width, since SwiftUI takes its size from
 * it.
 */
function HostedSectionElement({ element }: { element: ReactElement }) {
  const { width } = useWindowDimensions();
  return (
    <VStack modifiers={hostedElementModifiers}>
      <RNHostView matchContents>
        <View style={{ width }}>{element}</View>
      </RNHostView>
    </VStack>
  );
}

function SettingsRow({
  row,
  colors,
  reorderable = false,
}: {
  row: SettingsRowModel;
  colors: SettingsListColors;
  /** In a section whose rows can be dragged, which can't be deleted. */
  reorderable?: boolean;
}) {
  const rowModifiers = [
    ...(reorderable ? [deleteDisabled(true)] : []),
    listRowBackground(colors.row),
    listRowSeparatorTint(colors.separator),
    disabled(Boolean(row.disabled)),
    // The rows set their own text colors, which SwiftUI won't dim for them.
    ...(row.disabled ? [opacity(0.5)] : []),
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

  // The Pending tag is only drawn, so it is spoken as part of the value.
  const spokenValue = [
    row.value || row.subtitle,
    row.pending ? 'Pending' : null,
  ]
    .filter(Boolean)
    .join(', ');
  const labelledRowModifiers = [
    ...rowModifiers,
    // One label and value, so text matching and VoiceOver read the title
    // alone rather than every text in the row run together.
    accessibilityLabel(row.title),
    ...(spokenValue ? [accessibilityValue(spokenValue)] : []),
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

  const body = row.onPress ? (
    <Button onPress={row.onPress} modifiers={labelledRowModifiers}>
      {content}
    </Button>
  ) : (
    content
  );

  if (!row.contextActions?.length) {
    return body;
  }

  return (
    <ContextMenu>
      <ContextMenu.Items>
        <MenuItems items={row.contextActions} />
      </ContextMenu.Items>
      <ContextMenu.Trigger>{body}</ContextMenu.Trigger>
    </ContextMenu>
  );
}

function MenuItems({ items }: { items: SettingsMenuItem[] }) {
  return items.map((item) => (
    <Button
      key={item.key}
      label={item.title}
      systemImage={
        item.systemImage as ComponentProps<typeof Button>['systemImage']
      }
      role={item.destructive ? 'destructive' : undefined}
      onPress={item.onPress}
    />
  ));
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
            labelLineLimit(row),
          ]}
        >
          {row.title}
        </Text>
        {row.subtitle ? (
          <Text
            modifiers={[
              font({ size: 13 }),
              foregroundStyle(colors.secondaryText),
              subtitleLineLimit(row),
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
 * Long text wraps over a few lines, such as a feature flag's description or
 * the explanation under a notification level, and an expanded row shows all
 * of it. Beside a value it keeps to one line so the value keeps its room.
 */
function labelLineLimit(row: SettingsRowModel) {
  return row.expanded ? lineLimit() : lineLimit(row.value ? 1 : 3);
}

/** A subtitle beside a value gets a second line, so a short explanation isn't cut off mid-word. */
function subtitleLineLimit(row: SettingsRowModel) {
  return row.expanded ? lineLimit() : lineLimit(row.value ? 2 : 3);
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
