import {
  Button,
  Icon,
  IconType,
  LoadingSpinner,
  Pressable,
  Text,
} from '@tloncorp/ui';
import { PropsWithChildren, ReactNode } from 'react';
import { Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack } from 'tamagui';

import { ImageAvatar } from '../../../ui/components/Avatar';
import { Badge } from '../../../ui/components/Badge';
import { ListItem } from '../../../ui/components/ListItem';

export function BotSettingsSection({
  title,
  description,
  children,
}: PropsWithChildren<{
  title?: string;
  description?: string;
}>) {
  return (
    <YStack gap="$m">
      {title ? (
        <Text
          size="$label/m"
          color="$secondaryText"
          fontWeight="500"
          paddingHorizontal="$s"
        >
          {title}
        </Text>
      ) : null}
      <YStack
        borderWidth={1}
        borderColor="$border"
        borderRadius="$xl"
        backgroundColor="$background"
        overflow="hidden"
      >
        {children}
      </YStack>
      {description ? (
        <Text size="$label/s" color="$secondaryText" paddingHorizontal="$s">
          {description}
        </Text>
      ) : null}
    </YStack>
  );
}

export function BotSettingsDivider() {
  return <View height={1} backgroundColor="$border" />;
}

export function BotSettingsRow({
  label,
  value,
  description,
  icon,
  pending,
  disabled,
  onPress,
  children,
}: PropsWithChildren<{
  label: string;
  value?: string;
  description?: string;
  icon?: IconType;
  pending?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}>) {
  const content = (
    <ListItem opacity={disabled ? 0.6 : 1}>
      {icon ? <ListItem.SystemIcon icon={icon} rounded /> : null}
      <ListItem.MainContent>
        <ListItem.Title>{label}</ListItem.Title>
        {description ? (
          <ListItem.Subtitle>{description}</ListItem.Subtitle>
        ) : null}
      </ListItem.MainContent>
      <XStack alignItems="center" gap="$s" flexShrink={0}>
        {pending ? <PendingBadge /> : null}
        {value ? (
          <Text
            size="$label/m"
            color="$tertiaryText"
            numberOfLines={1}
            maxWidth={160}
          >
            {value}
          </Text>
        ) : null}
        {children}
        {onPress ? (
          <Icon type="ChevronRight" size="$m" color="$tertiaryText" />
        ) : null}
      </XStack>
    </ListItem>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      borderRadius="$xl"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
    >
      {content}
    </Pressable>
  );
}

export function BotSwitchRow({
  label,
  description,
  checked,
  disabled,
  pending,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  pending?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <BotSettingsRow label={label} description={description} pending={pending}>
      <Switch
        value={checked}
        disabled={disabled}
        onValueChange={onCheckedChange}
      />
    </BotSettingsRow>
  );
}

export function PendingBadge() {
  return <Badge text="Pending" type="warning" size="micro" />;
}

export function SelectableRow({
  label,
  description,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      borderRadius="$xl"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
    >
      <ListItem opacity={disabled ? 0.6 : 1}>
        <ListItem.MainContent>
          <ListItem.Title>{label}</ListItem.Title>
          {description ? (
            <ListItem.Subtitle>{description}</ListItem.Subtitle>
          ) : null}
        </ListItem.MainContent>
        {selected ? (
          <XStack alignItems="center" flexShrink={0}>
            <Icon type="Checkmark" size="$m" color="$positiveActionText" />
          </XStack>
        ) : null}
      </ListItem>
    </Pressable>
  );
}

export function BotIdentityHeader({
  title,
  subtitle,
  avatarUrl,
  ready,
  restarting,
}: {
  title: string;
  subtitle: string;
  avatarUrl?: string;
  ready: boolean;
  restarting?: boolean;
}) {
  // Reflects the bot's runtime status only. Unsaved edits are surfaced by the
  // Apply bar, so they don't belong in this badge (a "Pending" badge there just
  // duplicates the bar and reads like the bot itself is unhealthy).
  const statusText = restarting ? 'Restarting…' : ready ? 'Online' : 'Starting';
  const statusType = restarting ? 'warning' : ready ? 'positive' : 'neutral';

  return (
    <XStack alignItems="center" gap="$l" paddingHorizontal="$s">
      <ImageAvatar
        imageUrl={avatarUrl || undefined}
        width={56}
        height={56}
        borderRadius="$l"
        fallback={
          <View
            width={56}
            height={56}
            alignItems="center"
            justifyContent="center"
            borderRadius="$l"
            backgroundColor="$background"
          >
            <Icon type="Face" size="$l" color="$secondaryText" />
          </View>
        }
      />
      <YStack flex={1} minWidth={0} gap="$2xs">
        <XStack alignItems="center" justifyContent="space-between" gap="$m">
          <Text size="$label/2xl" fontWeight="600" numberOfLines={1} flex={1}>
            {title || 'Tlonbot'}
          </Text>
          <Badge text={statusText} type={statusType} size="micro" />
        </XStack>
        <Text size="$label/m" color="$secondaryText" numberOfLines={1}>
          {subtitle}
        </Text>
      </YStack>
    </XStack>
  );
}

export function ApplyChangesBar({
  changeCount,
  labels,
  applying,
  disabled,
  error,
  onDiscard,
  onApply,
}: {
  changeCount: number;
  labels: string[];
  applying: boolean;
  disabled?: boolean;
  error?: string | null;
  onDiscard: () => void;
  onApply: () => void;
}) {
  const insets = useSafeAreaInsets();

  if (changeCount === 0 && !error && !applying) {
    return null;
  }

  return (
    <YStack
      borderTopWidth={1}
      borderColor="$border"
      backgroundColor="$background"
      paddingHorizontal="$l"
      paddingTop="$m"
      paddingBottom={insets.bottom}
      gap="$m"
    >
      {applying ? <LoadingSpinner size="small" /> : null}
      {!applying ? (
        <YStack gap="$m">
          <Button
            preset="secondaryOutline"
            label="Discard"
            onPress={onDiscard}
          />
          <Button
            preset="primary"
            label={`Apply ${changeCount} Change${changeCount > 1 ? 's' : ''}`}
            disabled={disabled}
            onPress={onApply}
          />
        </YStack>
      ) : null}
    </YStack>
  );
}

export function BotSettingsErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <Text size="$label/s" color="$negativeActionText" paddingHorizontal="$s">
      {children}
    </Text>
  );
}

export function EmptyRowText({ children }: { children: ReactNode }) {
  return (
    <View paddingHorizontal="$l" paddingVertical="$xl">
      <Text size="$label/m" color="$secondaryText">
        {children}
      </Text>
    </View>
  );
}
