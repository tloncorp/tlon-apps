import { Button, Icon, LoadingSpinner, Text } from '@tloncorp/ui';
import type { ComponentProps, ReactNode } from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

/** Corner radius of a top-level bot card. */
export const A2UI_CARD_RADIUS = 20;
/** Side and bottom padding of a top-level bot card. */
export const A2UI_CARD_PADDING = 20;
/** Top padding of a top-level bot card; a kicker's short line box makes 18 read as 20. */
export const A2UI_CARD_PADDING_TOP = 18;
/** A card inside a card: what a request is about. */
export const A2UI_INNER_CARD = { radius: 14, paddingX: 14, paddingY: 12 };
/** Height of an option row. */
export const A2UI_OPTION_ROW_HEIGHT = 44;
/** Side padding of an option row, matching the card's. */
export const A2UI_OPTION_ROW_PADDING = 20;

/**
 * Bot card type. Cards use their own denser scale (13, 15, 17) rather than
 * the app's label sizes, and draw text untrimmed so these line heights set
 * the spacing, as in the design.
 */
export const A2UI_TYPE = {
  title: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  label: { fontSize: 15, lineHeight: 20 },
  labelStrong: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  body: { fontSize: 15, lineHeight: 22 },
  note: { fontSize: 13, lineHeight: 18 },
  noteStrong: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  kicker: { fontSize: 13, lineHeight: 16, fontWeight: '500' },
} as const;

/** Vertical rhythm between the parts of a card. */
export const A2UI_SPACE = {
  /** Kicker to title. */
  afterKicker: 10,
  /** Title to whatever follows it. */
  afterTitle: 16,
  /** Lines of one block of text. */
  line: 4,
  /** Blocks: an inner card, a note, a row. */
  block: 12,
  /** Before a card's row of buttons. */
  beforeButtons: 20,
  /** Before the buttons inside an inner card. */
  beforeInnerButtons: 12,
  /** Between inner cards, such as pending requests. */
  betweenInnerCards: 10,
};

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
          paddingTop={16}
          paddingHorizontal={A2UI_CARD_PADDING}
          paddingBottom={A2UI_CARD_PADDING}
          gap={8}
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
  // A primary button that can't be used yet sits on the light fill rather
  // than the darker disabled grey.
  const surface =
    disabled && style.fill === 'solid' ? '$secondaryBackground' : style.surface;
  return (
    <Button.Frame
      size="medium"
      fill={style.fill}
      intent={style.intent}
      {...(surface ? { backgroundColor: surface, borderColor: surface } : null)}
      height={44}
      borderRadius={12}
      paddingVertical={0}
      paddingHorizontal={16}
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
        <Button.Text size="medium" numberOfLines={1} {...A2UI_TYPE.labelStrong}>
          {label}
        </Button.Text>
      )}
    </Button.Frame>
  );
}

/** How a card's answer reads: the primary choice, another one, or a block. */
export type A2UIResultTone = 'positive' | 'neutral' | 'destructive';

function resultColors(tone: A2UIResultTone | undefined) {
  switch (tone) {
    case 'positive':
      return {
        background: '$positiveBackground',
        foreground: '$positiveActionText',
      } as const;
    case 'destructive':
      return {
        background: '$negativeBackground',
        foreground: '$negativeActionText',
      } as const;
    default:
      return {
        background: '$secondaryBackground',
        foreground: '$primaryText',
      } as const;
  }
}

/** A card's state beside its kicker, such as "2 waiting" or "Allowed". */
export function A2UIStatusText({
  label,
  tone,
}: {
  label: string;
  tone?: A2UIResultTone;
}) {
  const color = tone ? resultColors(tone).foreground : '$secondaryText';
  return (
    <Text size="$label/m" fontWeight="500" color={color} flexShrink={0}>
      {label}
    </Text>
  );
}

/** Takes the place of a card's button row once one of its buttons is used. */
export function A2UIResultLine({
  label,
  tone,
}: {
  label: string;
  tone: A2UIResultTone;
}) {
  const { background, foreground } = resultColors(tone);
  return (
    <XStack
      marginTop="$xl"
      gap="$m"
      alignItems="center"
      paddingVertical="$l"
      paddingHorizontal="$xl"
      borderRadius="$l"
      backgroundColor={background}
      accessible
      accessibilityLabel={label}
    >
      <Icon type="Checkmark" color={foreground} customSize={[16, 16]} />
      <Text
        size="$label/l"
        color={foreground}
        trimmed={false}
        flex={1}
        {...A2UI_TEXT_BREAKING}
      >
        {label}
      </Text>
    </XStack>
  );
}
