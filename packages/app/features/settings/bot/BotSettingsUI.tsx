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

import { useTopLevelTabBarClearance } from '../../../navigation/useTopLevelTabBarContentInset';
import { ImageAvatar, SigilAvatar } from '../../../ui/components/Avatar';
import { Badge } from '../../../ui/components/Badge';
import { ListItem } from '../../../ui/components/ListItem';
import {
  SettingsDivider,
  SettingsSection,
} from '../../../ui/components/SettingsSection';

export const BotSettingsSection = SettingsSection;
export const BotSettingsDivider = SettingsDivider;

export function BotSettingsRow({
  label,
  value,
  valueColor = '$tertiaryText',
  description,
  descriptionNumberOfLines = 1,
  multilineDescriptionGap = 12,
  multilinePaddingVertical = 32,
  icon,
  pending,
  disabled,
  onPress,
  children,
}: PropsWithChildren<{
  label: string;
  value?: string;
  valueColor?: '$primaryText' | '$secondaryText' | '$tertiaryText';
  description?: string;
  descriptionNumberOfLines?: number;
  multilineDescriptionGap?: number;
  multilinePaddingVertical?: number;
  icon?: IconType;
  pending?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}>) {
  const hasMultilineDescription =
    Boolean(description) && descriptionNumberOfLines > 1;
  const content = (
    <ListItem
      opacity={disabled ? 0.6 : 1}
      paddingVertical={
        hasMultilineDescription ? multilinePaddingVertical : '$l'
      }
    >
      {icon ? <ListItem.SystemIcon icon={icon} rounded /> : null}
      <ListItem.MainContent
        height={hasMultilineDescription ? 'auto' : '$4xl'}
        minHeight="$4xl"
        justifyContent={hasMultilineDescription ? 'center' : 'space-around'}
        gap={hasMultilineDescription ? multilineDescriptionGap : undefined}
      >
        <ListItem.Title>{label}</ListItem.Title>
        {description ? (
          <ListItem.Subtitle numberOfLines={descriptionNumberOfLines}>
            {description}
          </ListItem.Subtitle>
        ) : null}
      </ListItem.MainContent>
      <XStack alignItems="center" gap="$s" flexShrink={0}>
        {pending ? <PendingBadge /> : null}
        {value ? (
          <Text
            size="$label/m"
            color={valueColor}
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
  descriptionNumberOfLines,
  multilineDescriptionGap,
  multilinePaddingVertical,
  checked,
  disabled,
  pending,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  descriptionNumberOfLines?: number;
  multilineDescriptionGap?: number;
  multilinePaddingVertical?: number;
  checked: boolean;
  disabled?: boolean;
  pending?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <BotSettingsRow
      label={label}
      description={description}
      descriptionNumberOfLines={descriptionNumberOfLines}
      multilineDescriptionGap={multilineDescriptionGap}
      multilinePaddingVertical={multilinePaddingVertical}
      pending={pending}
    >
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
  endContent,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  description?: string;
  endContent?: ReactNode;
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
        {endContent || selected ? (
          <XStack alignItems="center" gap="$s" flexShrink={0}>
            {endContent}
            {selected ? (
              <Icon type="Checkmark" size="$m" color="$positiveActionText" />
            ) : null}
          </XStack>
        ) : null}
      </ListItem>
    </Pressable>
  );
}

const botAvatarSize = 48;

export function BotAvatar({
  avatarUrl,
  sigilContactId,
}: {
  avatarUrl?: string;
  /** Shown in place of a missing avatar; the face icon stands in without it. */
  sigilContactId?: string;
}) {
  return (
    <ImageAvatar
      imageUrl={avatarUrl || undefined}
      width={botAvatarSize}
      height={botAvatarSize}
      borderRadius="$l"
      fallback={
        sigilContactId ? (
          <SigilAvatar
            contactId={sigilContactId}
            size="custom"
            width={botAvatarSize}
            height={botAvatarSize}
            borderRadius="$l"
          />
        ) : (
          <View
            width={botAvatarSize}
            height={botAvatarSize}
            alignItems="center"
            justifyContent="center"
            borderRadius="$l"
            backgroundColor="$background"
          >
            <Icon type="Face" size="$l" color="$secondaryText" />
          </View>
        )
      }
    />
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
  // On the Settings tab the native tab bar floats over the bottom of the
  // screen, so the bar has to clear it rather than the home indicator alone.
  // Off the tab screens the clearance is 0 and the safe area applies as before.
  const tabBarClearance = useTopLevelTabBarClearance();

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
      paddingBottom={tabBarClearance || insets.bottom}
      gap="$m"
    >
      {/* Surface apply errors right here, above the buttons — otherwise they're
          easy to miss buried in the scrolling form. */}
      {error ? <BotSettingsErrorText>{error}</BotSettingsErrorText> : null}
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
