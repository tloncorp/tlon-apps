import { Pressable, Text } from '@tloncorp/ui';
import type { ComponentProps, ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';

import { A2UI_OPTION_ROW_PADDING, A2UI_TYPE } from './a2uiCardParts';

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
  paddingHorizontal = A2UI_OPTION_ROW_PADDING,
  paddingVertical,
  subtitle,
  testID,
  trailing,
}: A2UIMenuRowProps) {
  return (
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
        gap={12}
        opacity={dimmed ? 0.5 : 1}
        // The hairline sits inside the row's height, so rows keep their pitch.
        borderBottomWidth={dividerAfter ? 1 : 0}
        borderBottomColor="$border"
      >
        {leading}
        {subtitle ? (
          <YStack flex={1} minWidth={0}>
            <Text
              size="$label/l"
              {...A2UI_TYPE.label}
              color={labelColor}
              fontWeight={labelWeight}
              trimmed={false}
              numberOfLines={labelCanWrap ? undefined : 1}
            >
              {label}
            </Text>
            <Text
              size="$label/s"
              {...A2UI_TYPE.note}
              color="$secondaryText"
              trimmed={false}
            >
              {subtitle}
            </Text>
          </YStack>
        ) : (
          <Text
            size="$label/l"
            {...A2UI_TYPE.label}
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
}
