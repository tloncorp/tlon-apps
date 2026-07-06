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
import { View, XStack, YStack } from 'tamagui';

import { Badge } from '../../../ui/components/Badge';

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
    <XStack
      minHeight={56}
      alignItems="center"
      gap="$l"
      paddingHorizontal="$l"
      paddingVertical="$m"
      opacity={disabled ? 0.6 : 1}
    >
      {icon ? (
        <View
          width="$3xl"
          height="$3xl"
          alignItems="center"
          justifyContent="center"
          borderRadius="$m"
          backgroundColor="$secondaryBackground"
        >
          <Icon type={icon} size="$m" color="$secondaryText" />
        </View>
      ) : null}
      <YStack flex={1} minWidth={0}>
        <Text size="$label/l" color="$primaryText" numberOfLines={1}>
          {label}
        </Text>
        {description ? (
          <Text size="$label/s" color="$secondaryText" numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </YStack>
      {pending ? <PendingBadge /> : null}
      {value ? (
        <Text
          size="$label/m"
          color="$secondaryText"
          numberOfLines={1}
          maxWidth="45%"
        >
          {value}
        </Text>
      ) : null}
      {children}
      {onPress ? (
        <Icon type="ChevronRight" size="$m" color="$tertiaryText" />
      ) : null}
    </XStack>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
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
      onPress={disabled ? undefined : onPress}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
    >
      <XStack
        minHeight={56}
        alignItems="center"
        gap="$l"
        paddingHorizontal="$l"
        paddingVertical="$m"
        opacity={disabled ? 0.6 : 1}
      >
        <YStack flex={1} minWidth={0}>
          <Text size="$label/l" color="$primaryText" numberOfLines={1}>
            {label}
          </Text>
          {description ? (
            <Text size="$label/s" color="$secondaryText" numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </YStack>
        {selected ? (
          <Icon type="Checkmark" size="$m" color="$positiveActionText" />
        ) : null}
      </XStack>
    </Pressable>
  );
}

export function BotIdentityHeader({
  title,
  subtitle,
  ready,
  pending,
  restarting,
}: {
  title: string;
  subtitle: string;
  ready: boolean;
  pending?: boolean;
  restarting?: boolean;
}) {
  const statusText = restarting
    ? 'Restarting…'
    : pending
      ? 'Pending'
      : ready
        ? 'Online'
        : 'Starting';
  const statusType =
    restarting || pending ? 'warning' : ready ? 'positive' : 'neutral';

  return (
    <XStack alignItems="center" gap="$l" paddingHorizontal="$s">
      <View
        width={56}
        height={56}
        alignItems="center"
        justifyContent="center"
        borderRadius="$l"
        backgroundColor="$secondaryBackground"
      >
        <Icon type="Face" size="$l" color="$secondaryText" />
      </View>
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
  if (changeCount === 0 && !error && !applying) {
    return null;
  }

  return (
    <YStack
      borderTopWidth={1}
      borderColor="$border"
      backgroundColor="$background"
      paddingHorizontal="$l"
      paddingVertical="$m"
      gap="$m"
    >
      <XStack alignItems="center" gap="$l">
        {applying ? <LoadingSpinner size="small" /> : null}
        <YStack flex={1} minWidth={0}>
          <Text size="$label/m" fontWeight="500" numberOfLines={1}>
            {applying
              ? 'Restarting gateway…'
              : `${changeCount} pending ${changeCount === 1 ? 'change' : 'changes'}`}
          </Text>
          <Text size="$label/s" color="$secondaryText" numberOfLines={1}>
            {applying
              ? 'Tlonbot is briefly offline'
              : error ?? labels.join(' · ')}
          </Text>
        </YStack>
        {!applying ? (
          <XStack gap="$m">
            <Button preset="minimal" label="Discard" onPress={onDiscard} />
            <Button
              preset="primary"
              label="Apply"
              disabled={disabled}
              onPress={onApply}
            />
          </XStack>
        ) : null}
      </XStack>
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
