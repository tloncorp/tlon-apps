import { Pressable, Text } from '@tloncorp/ui';
import type { ComponentProps, ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';

type A2UIMenuRowProps = {
  accessibilityLabel: string;
  accessibilityRole?: ComponentProps<typeof Pressable>['accessibilityRole'];
  accessibilityState?: ComponentProps<typeof Pressable>['accessibilityState'];
  accessibilityValue?: ComponentProps<typeof Pressable>['accessibilityValue'];
  backgroundColor?: ComponentProps<typeof XStack>['backgroundColor'];
  dimmed?: boolean;
  disabled?: boolean;
  /** Draw a full-width hairline below the row. */
  dividerAfter?: boolean;
  label: string;
  labelCanWrap?: boolean;
  labelColor?: ComponentProps<typeof Text>['color'];
  labelWeight?: ComponentProps<typeof Text>['fontWeight'];
  leading?: ReactNode;
  minHeight?: number;
  onPress?: () => void;
  paddingHorizontal?: ComponentProps<typeof XStack>['paddingHorizontal'];
  paddingVertical?: ComponentProps<typeof XStack>['paddingVertical'];
  subtitle?: string;
  testID?: string;
  trailing?: ReactNode;
};

/** Shared scaffold for the option rows inside A2UI chat cards. */
export function A2UIMenuRow({
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  accessibilityValue,
  backgroundColor = '$background',
  dimmed = false,
  disabled = false,
  dividerAfter = false,
  label,
  labelCanWrap = false,
  labelColor = '$primaryText',
  labelWeight,
  leading,
  minHeight = 52,
  onPress,
  paddingHorizontal = '$xl',
  paddingVertical,
  subtitle,
  testID,
  trailing,
}: A2UIMenuRowProps) {
  const row = (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityValue={accessibilityValue}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
    >
      <XStack
        minHeight={minHeight}
        paddingVertical={paddingVertical}
        paddingHorizontal={paddingHorizontal}
        backgroundColor={backgroundColor}
        alignItems="center"
        gap="$m"
        opacity={dimmed ? 0.5 : 1}
      >
        {leading}
        {subtitle ? (
          <YStack flex={1} minWidth={0}>
            <Text
              size="$label/l"
              color={labelColor}
              fontWeight={labelWeight}
              trimmed={false}
              numberOfLines={labelCanWrap ? undefined : 1}
            >
              {label}
            </Text>
            <Text size="$label/s" color="$secondaryText">
              {subtitle}
            </Text>
          </YStack>
        ) : (
          <Text
            size="$label/l"
            color={labelColor}
            fontWeight={labelWeight}
            trimmed={false}
            flex={1}
            minWidth={0}
            numberOfLines={labelCanWrap ? undefined : 1}
          >
            {label}
          </Text>
        )}
        {trailing}
      </XStack>
    </Pressable>
  );

  return dividerAfter ? (
    <YStack>
      {row}
      <YStack height={1} backgroundColor="$border" />
    </YStack>
  ) : (
    row
  );
}
