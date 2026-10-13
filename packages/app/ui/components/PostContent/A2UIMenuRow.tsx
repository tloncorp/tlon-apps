import { Pressable, Text } from '@tloncorp/ui';
import type { ComponentProps, ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';

type A2UIMenuRowProps = {
  accessibilityLabel: string;
  accessibilityState?: ComponentProps<typeof Pressable>['accessibilityState'];
  bordered?: boolean;
  dimmed?: boolean;
  disabled?: boolean;
  dividerAfter?: boolean;
  dividerOutside?: boolean;
  label: string;
  labelColor?: ComponentProps<typeof Text>['color'];
  leading?: ReactNode;
  marginTop?: ComponentProps<typeof XStack>['marginTop'];
  minHeight?: number;
  onPress?: () => void;
  paddingVertical?: ComponentProps<typeof XStack>['paddingVertical'];
  prominent?: boolean;
  subtitle?: string;
  testID?: string;
  trailing?: ReactNode;
};

/** Shared scaffold for the compact controls embedded in A2UI chat cards. */
export function A2UIMenuRow({
  accessibilityLabel,
  accessibilityState,
  bordered = false,
  dimmed = false,
  disabled = false,
  dividerAfter = false,
  dividerOutside = false,
  label,
  labelColor,
  leading,
  marginTop,
  minHeight = 52,
  onPress,
  paddingVertical,
  prominent = false,
  subtitle,
  testID,
  trailing,
}: A2UIMenuRowProps) {
  const row = (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
    >
      <XStack
        minHeight={minHeight}
        marginTop={marginTop}
        paddingVertical={paddingVertical}
        paddingHorizontal="$m"
        backgroundColor={prominent ? '$primaryText' : '$background'}
        borderWidth={bordered ? 1 : 0}
        borderColor="$border"
        borderRadius={bordered ? '$m' : 0}
        borderBottomWidth={
          dividerAfter && !dividerOutside ? 1 : bordered ? 1 : 0
        }
        borderBottomColor="$border"
        alignItems="center"
        gap="$m"
        opacity={dimmed ? 0.5 : 1}
      >
        {leading}
        {subtitle ? (
          <YStack flex={1} minWidth={0}>
            <Text
              size="$label/l"
              color={labelColor ?? (prominent ? '$background' : '$primaryText')}
              trimmed={false}
              numberOfLines={1}
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
            color={labelColor ?? (prominent ? '$background' : '$primaryText')}
            trimmed={false}
            flex={1}
            minWidth={0}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
        {trailing}
      </XStack>
    </Pressable>
  );

  return dividerAfter && dividerOutside ? (
    <YStack>
      {row}
      <YStack height={1} backgroundColor="$border" />
    </YStack>
  ) : (
    row
  );
}
