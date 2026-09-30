import { Text } from '@tloncorp/ui';
import { PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { View, YStack } from 'tamagui';

/**
 * Card corners for a `grouped` section on native, matching the native settings
 * lists: iOS's inset-grouped cards and the Compose cards on Android.
 */
const groupedCardRadius = Platform.OS === 'ios' ? 26 : 16;
const isGroupedNative = (variant: SectionVariant) =>
  variant === 'grouped' && Platform.OS !== 'web';

/**
 * `bordered` is the web card look. `grouped` is for settings forms that sit
 * beside the native settings lists: borderless cards with native corners.
 */
type SectionVariant = 'bordered' | 'grouped';

export function SettingsSection({
  title,
  subtitle,
  description,
  variant = 'bordered',
  children,
}: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  description?: string;
  variant?: SectionVariant;
}>) {
  const grouped = isGroupedNative(variant);
  return (
    <YStack gap="$m">
      {title || subtitle ? (
        <YStack gap="$xs" paddingHorizontal="$s">
          {title ? (
            <Text size="$label/m" color="$secondaryText" fontWeight="500">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text size="$label/s" color="$secondaryText">
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      ) : null}
      <YStack
        borderWidth={grouped ? 0 : 1}
        borderColor="$border"
        borderRadius={grouped ? groupedCardRadius : '$xl'}
        style={grouped ? { borderCurve: 'continuous' } : undefined}
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

/** Grouped dividers start at the row's text, like native separators. */
export function SettingsDivider({
  variant = 'bordered',
}: {
  variant?: SectionVariant;
}) {
  return isGroupedNative(variant) ? (
    <View height={1} marginLeft="$l" backgroundColor="$secondaryBorder" />
  ) : (
    <View height={1} backgroundColor="$border" />
  );
}
