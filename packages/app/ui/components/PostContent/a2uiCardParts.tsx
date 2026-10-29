import { Button, Icon, LoadingSpinner } from '@tloncorp/ui';
import type { ComponentProps, ReactNode } from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

/** Corner radius of a top-level bot card. */
export const A2UI_CARD_RADIUS = 20;
/** Inner padding of a top-level bot card. */
export const A2UI_CARD_PADDING = 20;
/** Height of an option row. */
export const A2UI_OPTION_ROW_HEIGHT = 44;

/**
 * Line breaking for bot card text: no one-word last lines on iOS and web,
 * evened-out lines on Android.
 */
export const A2UI_TEXT_BREAKING = isWeb
  ? // React Native's style types do not know CSS text-wrap yet.
    ({ style: { textWrap: 'pretty' } } as Record<string, unknown>)
  : ({
      lineBreakStrategyIOS: 'push-out',
      textBreakStrategy: 'balanced',
    } as const);

/**
 * The white card that holds an option list. Rows run edge to edge with
 * full-width hairlines; the footer holds the card's buttons.
 */
export function A2UIOptionCard({
  children,
  footer,
  footerDirection = 'row',
}: {
  children: ReactNode;
  footer?: ReactNode;
  /** Stack the footer buttons when their labels are too long to share. */
  footerDirection?: 'row' | 'column';
}) {
  return (
    <YStack
      width="100%"
      backgroundColor="$background"
      borderWidth={1}
      borderColor="$border"
      borderRadius={A2UI_CARD_RADIUS}
      overflow="hidden"
    >
      {children}
      {footer ? (
        <XStack
          flexDirection={footerDirection}
          padding="$xl"
          gap="$m"
          borderTopWidth={1}
          borderTopColor="$border"
        >
          {footer}
        </XStack>
      ) : null}
    </YStack>
  );
}

/**
 * The mark at the start of an option row: a circle when one answer is
 * allowed, a rounded square when several are.
 */
export function A2UIChoiceIndicator({
  selected,
  shape,
}: {
  selected: boolean;
  shape: 'circle' | 'square';
}) {
  // Tamagui's compiler can drop inline ternaries on token-valued props.
  const fill = selected ? '$primaryText' : '$background';
  const border = selected ? '$primaryText' : '$tertiaryText';
  return (
    <View
      width={20}
      height={20}
      borderRadius={shape === 'circle' ? 10 : 6}
      borderWidth={1.5}
      borderColor={border}
      backgroundColor={fill}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      {selected ? (
        <Icon type="Checkmark" color="$background" customSize={[12, 12]} />
      ) : null}
    </View>
  );
}

export type A2UICardButtonTone = 'primary' | 'secondary' | 'borderless';

/** Fill, intent and surface for a card button. */
export function getA2UICardButtonStyle(tone: A2UICardButtonTone) {
  switch (tone) {
    case 'primary':
      return { fill: 'solid', intent: 'primary', surface: undefined } as const;
    case 'borderless':
      return { fill: 'text', intent: 'primary', surface: undefined } as const;
    case 'secondary':
      return {
        fill: 'ghost',
        intent: 'primary',
        surface: '$secondaryBackground',
      } as const;
  }
}

/** A 44 px card button: ink primary, filled grey secondary, text borderless. */
export function A2UICardButton({
  accessibilityLabel,
  disabled = false,
  flex = 1,
  label,
  loading = false,
  onPress,
  testID,
  tone,
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  flex?: ComponentProps<typeof Button.Frame>['flex'];
  label: string;
  loading?: boolean;
  onPress?: () => void;
  testID?: string;
  tone: A2UICardButtonTone;
}) {
  const style = getA2UICardButtonStyle(tone);
  return (
    <Button.Frame
      size="medium"
      fill={style.fill}
      intent={style.intent}
      {...(style.surface
        ? { backgroundColor: style.surface, borderColor: style.surface }
        : null)}
      height={44}
      paddingVertical={0}
      paddingHorizontal="$xl"
      flex={flex}
      disabled={disabled}
      dimmed={disabled && style.fill !== 'solid'}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      testID={testID}
      onPress={disabled ? undefined : onPress}
    >
      {loading ? (
        <LoadingSpinner size="small" />
      ) : (
        <Button.Text size="medium" numberOfLines={1}>
          {label}
        </Button.Text>
      )}
    </Button.Frame>
  );
}
