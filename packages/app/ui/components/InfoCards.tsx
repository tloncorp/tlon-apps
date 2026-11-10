// The pieces profiles and the workspace, channel and group chat info screens
// are built from: a centered header, round action buttons, and white cards
// on the gray page.
import {
  Icon,
  type IconType,
  Pressable,
  Text,
  triggerHaptic,
} from '@tloncorp/ui';
import { type ComponentProps, type ReactNode, useCallback } from 'react';
import { View, XStack, YStack, styled } from 'tamagui';

import { WidgetPane } from './WidgetPane';

export const PaddedBlock = styled(YStack, {
  borderRadius: '$2xl',
  padding: '$2xl',
  gap: '$l',
  justifyContent: 'center',
  backgroundColor: '$background',
});

export const INFO_HEADER_AVATAR_SIZE = 112;
export const INFO_HEADER_AVATAR_RADIUS = 30;

// A small lift under the header avatar, the one shadow on the screen.
export const infoHeaderAvatarShadow = {
  borderRadius: INFO_HEADER_AVATAR_RADIUS,
  shadowColor: '#000000',
  shadowOpacity: 0.14,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
} as const;

/**
 * A small avatar tucked on the header avatar's corner: a bot's owner, or the
 * workspace a channel is in.
 */
export function InfoHeaderBadge({
  children,
  testID,
}: {
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View
      position="absolute"
      right={-10}
      bottom={-10}
      padding="$xs"
      borderRadius={15}
      backgroundColor="$secondaryBackground"
      testID={testID}
    >
      {children}
    </View>
  );
}

/** The header badge's own avatar size. */
export const INFO_HEADER_BADGE = { size: 40, radius: 11 } as const;

/**
 * A white tile in the header avatar's place, holding an icon, for a channel or
 * chat without an image of its own.
 */
export function InfoHeaderIconTile({ icon }: { icon: IconType }) {
  return (
    <View
      width={INFO_HEADER_AVATAR_SIZE}
      height={INFO_HEADER_AVATAR_SIZE}
      borderRadius={INFO_HEADER_AVATAR_RADIUS}
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
    >
      <Icon type={icon} customSize={[56, 56]} color="$primaryText" />
    </View>
  );
}

/**
 * The top of an info screen: the avatar, the name under it, and a line about
 * what it is.
 */
export function InfoHeader({
  avatar,
  badge,
  title,
  subtitle,
  testID,
}: {
  avatar: ReactNode;
  badge?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  testID?: string;
}) {
  return (
    <YStack
      alignItems="center"
      paddingTop="$l"
      paddingHorizontal="$xl"
      testID={testID}
    >
      <View position="relative">
        <View {...infoHeaderAvatarShadow}>{avatar}</View>
        {badge}
      </View>
      <Text
        marginTop={20}
        fontSize={28}
        lineHeight={34}
        trimmed={false}
        numberOfLines={2}
        textAlign="center"
        maxWidth="100%"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          size="$label/l"
          color="$secondaryText"
          marginTop="$xs"
          textAlign="center"
        >
          {subtitle}
        </Text>
      ) : null}
    </YStack>
  );
}

/** The name under the avatar ends with this when it is a bot's. */
export function BotTag({ onCard }: { onCard?: boolean }) {
  return (
    <View
      // On the page it is a white chip; inside a white card, a gray one.
      backgroundColor={onCard ? '$secondaryBackground' : '$background'}
      borderRadius="$m"
      paddingHorizontal="$m"
      paddingVertical="$2xs"
      flexShrink={0}
      testID="ProfileBotTag"
    >
      <Text size="$label/s" color="$secondaryText">
        Bot
      </Text>
    </View>
  );
}

/** Who can see or change a card's settings, at the right of its title. */
export function CardScopeLabel({ children }: { children: string }) {
  return (
    <Text size="$label/m" color="$tertiaryText">
      {children}
    </Text>
  );
}

// Sized and spaced like the round buttons on an iOS contact card: 48 pt
// circles about 69 pt apart, with room for a label under each.
const ACTION_CIRCLE_SIZE = 48;
const ACTION_CIRCLE_COLUMN = 60;
const ACTION_CIRCLE_GAP = 9;

/** A centered row of action circles. */
export function ActionCircleRow({ children }: { children: ReactNode }) {
  return (
    <XStack justifyContent="center" gap={ACTION_CIRCLE_GAP}>
      {children}
    </XStack>
  );
}

export function ActionCircle({
  icon,
  iconSize = 24,
  label,
  hero,
  onPress,
  testID,
}: {
  icon: IconType;
  iconSize?: number;
  label: string;
  /** The one main action, drawn in the dark fill. */
  hero?: boolean;
  /** Left out, the circle shows a state rather than an action. */
  onPress?: () => void;
  testID?: string;
}) {
  const handlePress = useCallback(() => {
    onPress?.();
    triggerHaptic('baseButtonClick');
  }, [onPress]);
  // The label is part of the button, as on a contact card.
  return (
    <Pressable
      width={ACTION_CIRCLE_COLUMN}
      alignItems="center"
      gap="$m"
      onPress={onPress ? handlePress : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <View
        width={ACTION_CIRCLE_SIZE}
        height={ACTION_CIRCLE_SIZE}
        borderRadius={ACTION_CIRCLE_SIZE / 2}
        alignItems="center"
        justifyContent="center"
        backgroundColor={hero ? '$primaryText' : '$background'}
      >
        <Icon
          type={icon}
          customSize={[iconSize, iconSize]}
          color={hero ? '$background' : '$primaryText'}
        />
      </View>
      <Text size="$label/s" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The Share circle's arrow fills more of its box than the other glyphs. */
export const SHARE_ICON_SIZE = 18;

export interface SettingsCardRow {
  key: string;
  title: string;
  value?: ReactNode;
  onPress?: () => void;
  /** Grayed out and not pressable, such as while the host is offline. */
  disabled?: boolean;
  testID?: string;
}

/**
 * A card of setting rows under a gray title, each with its value and a
 * chevron at the right.
 */
export function SettingsCard({
  title,
  scope,
  rows,
  testID,
}: {
  title: string;
  /** Who the settings are for, at the right of the title. */
  scope?: string;
  rows: SettingsCardRow[];
  testID?: string;
}) {
  return (
    <PaddedBlock gap="$s" paddingBottom="$l" testID={testID}>
      <XStack justifyContent="space-between" alignItems="center">
        <Text size="$body" color="$tertiaryText">
          {title}
        </Text>
        {scope ? <CardScopeLabel>{scope}</CardScopeLabel> : null}
      </XStack>
      <YStack>
        {rows.map((row, i) => (
          <SettingsCardRowView key={row.key} row={row} first={i === 0} />
        ))}
      </YStack>
    </PaddedBlock>
  );
}

function SettingsCardRowView({
  row,
  first,
}: {
  row: SettingsCardRow;
  first: boolean;
}) {
  const { onPress } = row;
  const handlePress = useCallback(() => {
    onPress?.();
    triggerHaptic('baseButtonClick');
  }, [onPress]);
  const pressable = !!onPress && !row.disabled;
  return (
    <Pressable
      onPress={pressable ? handlePress : undefined}
      disabled={!pressable}
      testID={row.testID}
    >
      <XStack
        minHeight="$4xl"
        alignItems="center"
        justifyContent="space-between"
        gap="$l"
        borderTopWidth={first ? 0 : 1}
        borderColor="$border"
      >
        <Text
          size="$body"
          color={row.disabled ? '$tertiaryText' : '$secondaryText'}
        >
          {row.title}
        </Text>
        <XStack alignItems="center" gap="$s" flexShrink={1} minWidth={0}>
          {typeof row.value === 'string' ? (
            <Text
              size="$body"
              numberOfLines={1}
              flexShrink={1}
              color={row.disabled ? '$tertiaryText' : '$primaryText'}
            >
              {row.value}
            </Text>
          ) : (
            row.value
          )}
          {pressable ? (
            <Icon type="ChevronRight" size="$s" color="$tertiaryText" />
          ) : null}
        </XStack>
      </XStack>
    </Pressable>
  );
}

export type TextCardProps = {
  title: string;
  text: string;
  /** Shown in place of empty text, in grey. */
  placeholder?: string;
  /** Makes the card a button with a chevron. */
  onPress?: () => void;
  onLongPress?: () => void;
} & ComponentProps<typeof WidgetPane>;

/** A titled card of text, such as a status, a bio or a description. */
export function TextCard({
  title,
  text,
  placeholder,
  onPress,
  onLongPress,
  ...rest
}: TextCardProps) {
  const handlePress = useCallback(() => {
    onPress?.();
    triggerHaptic('baseButtonClick');
  }, [onPress]);
  if (!text.length && !placeholder) {
    return null;
  }
  const card = (
    <WidgetPane borderRadius="$2xl" padding="$2xl" width="100%" {...rest}>
      <XStack alignItems="center" gap="$l">
        <YStack flex={1} minWidth={0}>
          <WidgetPane.Title>{title}</WidgetPane.Title>
          <Text
            size="$body"
            trimmed={false}
            color={text.length ? '$primaryText' : '$tertiaryText'}
          >
            {text.length ? text : placeholder}
          </Text>
        </YStack>
        {onPress ? (
          <Icon type="ChevronRight" size="$s" color="$tertiaryText" />
        ) : null}
      </XStack>
    </WidgetPane>
  );
  return onPress || onLongPress ? (
    <Pressable
      borderRadius="$2xl"
      onPress={onPress ? handlePress : undefined}
      onLongPress={onLongPress}
    >
      {card}
    </Pressable>
  ) : (
    card
  );
}

export type ConnectionState = 'online' | 'offline' | 'pending';

export function connectionStateText(status: ConnectionState) {
  return status === 'online'
    ? 'Online'
    : status === 'offline'
      ? 'Offline'
      : 'Pending';
}

/**
 * A square-ish tile: a label and its value along the top, and a mark with an
 * optional caption along the bottom. Two sit side by side.
 */
export function InfoTile({
  label,
  value,
  mark,
  caption,
  onPress,
  chevron = true,
  testID,
}: {
  label: string;
  value: string;
  mark: ReactNode;
  caption?: string;
  onPress?: () => void;
  /** Whether a pressable tile says so with a chevron by its value. */
  chevron?: boolean;
  testID?: string;
}) {
  const handlePress = useCallback(() => {
    onPress?.();
    triggerHaptic('baseButtonClick');
  }, [onPress]);
  const tile = (
    <PaddedBlock height={120} padding="$2xl" justifyContent="space-between">
      <XStack width="100%" justifyContent="space-between" alignItems="center">
        <Text size="$body" color="$tertiaryText">
          {label}
        </Text>
        <XStack alignItems="center" gap="$s">
          <Text size="$body">{value}</Text>
          {onPress && chevron ? (
            <Icon type="ChevronRight" size="$s" color="$tertiaryText" />
          ) : null}
        </XStack>
      </XStack>
      <XStack alignItems="center" justifyContent="space-between" gap="$m">
        {mark}
        {caption ? (
          <Text
            size="$label/s"
            color="$secondaryText"
            numberOfLines={1}
            // A whole @p fits a half-width tile only just; shrink rather
            // than cut it.
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            flexShrink={1}
          >
            {caption}
          </Text>
        ) : null}
      </XStack>
    </PaddedBlock>
  );
  // Both kinds sit in the same even share of the row, so a pressable tile
  // and a plain one beside it are the same width.
  return onPress ? (
    <Pressable
      flex={1}
      flexBasis={0}
      borderRadius="$2xl"
      onPress={handlePress}
      testID={testID}
    >
      {tile}
    </Pressable>
  ) : (
    <View flex={1} flexBasis={0} testID={testID}>
      {tile}
    </View>
  );
}

/** A colored dot for whether a ship can be reached. */
export function ConnectionMark({
  status,
  square,
}: {
  status: ConnectionState;
  /** Drawn square, as a sponsor's is. */
  square?: boolean;
}) {
  return (
    <View
      width="$3xl"
      height="$3xl"
      borderRadius={square ? '$xs' : 100}
      alignItems="center"
      justifyContent="center"
      backgroundColor={
        status === 'online'
          ? '$positiveActionText'
          : status === 'offline'
            ? '$negativeActionText'
            : '$secondaryText'
      }
    >
      {status === 'pending' ? (
        <Text color="$background" size="$body">
          ?
        </Text>
      ) : (
        <Icon
          type={status === 'offline' ? 'Stop' : 'Record'}
          size="$s"
          color="$background"
        />
      )}
    </View>
  );
}

/** A full-width red action at the end of the screen, such as Leave. */
export function DestructiveCard({
  actions,
}: {
  actions: {
    key: string;
    title: string;
    onPress: () => void;
    testID?: string;
  }[];
}) {
  if (!actions.length) {
    return null;
  }
  return (
    <YStack
      borderRadius="$2xl"
      backgroundColor="$background"
      paddingHorizontal="$2xl"
    >
      {actions.map((action, i) => (
        <Pressable
          key={action.key}
          onPress={action.onPress}
          testID={action.testID}
        >
          <XStack
            height={60}
            alignItems="center"
            borderTopWidth={i === 0 ? 0 : 1}
            borderColor="$border"
          >
            <Text size="$body" color="$negativeActionText">
              {action.title}
            </Text>
          </XStack>
        </Pressable>
      ))}
    </YStack>
  );
}
