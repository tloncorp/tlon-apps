import React from 'react';
import {
  ColorTokens,
  createStyledContext,
  styled,
  withStaticProperties,
} from 'tamagui';

import { triggerHaptic } from '../utils/haptics';
import { Icon, IconType } from './Icon';
import { LoadingSpinner } from './LoadingSpinner';
import Pressable from './Pressable';
import { Text, trimSettings } from './TextV2';

export type ButtonSize = 'large' | 'medium' | 'small';
export type ButtonStyle = 'solid' | 'outline' | 'ghost' | 'text';
export type ButtonIntent =
  | 'primary'
  | 'secondary'
  | 'helper'
  | 'positive'
  | 'negative'
  | 'notice'
  | 'overwrite';

export type ButtonPreset =
  | 'hero'
  | 'heroDestructive'
  | 'positive'
  | 'primary'
  | 'secondary'
  | 'secondaryOutline'
  | 'outline'
  | 'destructive'
  | 'minimal'
  | 'destructiveMinimal';

type PresetConfig = {
  intent: ButtonIntent;
  fill: ButtonStyle;
  size?: ButtonSize;
  centered?: boolean;
};

const presetConfigs: Record<ButtonPreset, PresetConfig> = {
  hero: { intent: 'primary', fill: 'solid', size: 'large', centered: true },
  heroDestructive: {
    intent: 'negative',
    fill: 'solid',
    size: 'large',
    centered: true,
  },
  positive: { intent: 'positive', fill: 'solid', size: 'small' },
  primary: { intent: 'primary', fill: 'solid' },
  secondary: { intent: 'secondary', fill: 'ghost', size: 'small' },
  secondaryOutline: { intent: 'secondary', fill: 'outline' },
  outline: { intent: 'primary', fill: 'outline' },
  destructive: { intent: 'negative', fill: 'solid' },
  minimal: { intent: 'primary', fill: 'text' },
  destructiveMinimal: { intent: 'negative', fill: 'text' },
};

export const ButtonContext = createStyledContext<{
  size: ButtonSize;
  fill: ButtonStyle;
  intent: ButtonIntent;
  disabled: boolean;
}>({
  size: 'medium',
  fill: 'solid',
  intent: 'primary',
  disabled: false,
});

type ButtonColor = ColorTokens | 'transparent';

const intentColors: {
  [K in ButtonIntent]: { [k: string]: ButtonColor };
} = {
  primary: {
    action: '$primaryText',
    background: 'transparent',
    border: '$primaryText',
    foreground: '$primaryText',
  },
  secondary: {
    action: '$border',
    background: 'transparent',
    border: '$shadow',
    foreground: '$secondaryText',
  },
  helper: {
    action: '$positiveActionText',
    background: '$positiveBackground',
    border: '$positiveBorder',
    foreground: '$positiveActionText',
  },
  positive: {
    action: '$positiveActionText',
    background: '$positiveBackground',
    border: '$positiveBorder',
    foreground: '$positiveActionText',
  },
  negative: {
    action: '$negativeActionText',
    background: '$negativeBackground',
    border: '$negativeBorder',
    foreground: '$negativeActionText',
  },
  notice: {
    action: '$systemNoticeText',
    background: '$systemNoticeBackground',
    border: '$positiveBorder',
    foreground: '$systemNoticeText',
  },
  overwrite: {
    action: '$negativeBorder',
    background: '$negativeActionText',
    foreground: '$negativeActionText',
  },
} as const;

type ButtonColors = {
  background: ButtonColor;
  border: ButtonColor;
  foreground: ButtonColor;
};

function resolveColors(
  intent: ButtonIntent,
  fill: ButtonStyle,
  disabled: boolean
): ButtonColors {
  const c = intentColors[intent];

  // Disabled solid buttons have special colors
  if (disabled && fill === 'solid') {
    const border =
      intent === 'primary' || intent === 'secondary' ? '$border' : c.border;
    return { background: border, border, foreground: '$tertiaryText' };
  }

  switch (fill) {
    case 'solid':
      return {
        background: c.action,
        border: c.action,
        foreground: (() => {
          switch (intent) {
            case 'secondary':
              return '$tertiaryText';
            case 'notice':
              return '$systemNoticeBackground';
            case 'primary':
            case 'helper':
            case 'positive':
            case 'negative':
              return '$background';
            default:
              return c.foreground;
          }
        })(),
      };
    case 'outline':
      return {
        background: c.background,
        border: intent === 'primary' ? '$primaryText' : c.border,
        foreground: c.foreground,
      };
    case 'ghost':
      return {
        background: '$background',
        border: 'transparent',
        foreground: c.foreground,
      };
    case 'text':
      return {
        background: 'transparent',
        border: 'transparent',
        foreground: c.foreground,
      };
  }
}

const ButtonFrame = styled(Pressable, {
  name: 'Button',
  context: ButtonContext,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  pressStyle: { opacity: 0.7 },
  variants: {
    size: {
      large: {
        height: '$6xl',
        paddingHorizontal: '$2xl',
        gap: '$l',
        borderRadius: '$xl',
      },
      medium: {
        height: 56,
        paddingHorizontal: '$xl',
        paddingVertical: '$xl',
        gap: '$m',
        borderRadius: '$l',
      },
      small: {
        height: 44,
        paddingLeft: '$xl',
        paddingRight: '$m',
        paddingVertical: '$m',
        gap: '$m',
        borderRadius: '$l',
      },
    },
    fill: {
      solid: { borderWidth: 1 },
      outline: { borderWidth: 1 },
      ghost: { borderWidth: 0 },
      text: {
        borderWidth: 0,
        height: 'auto',
        paddingHorizontal: 0,
        paddingVertical: 0,
      },
    },
    intent: (
      val: ButtonIntent,
      {
        props,
      }: {
        props: {
          fill?: ButtonStyle;
          disabled?: boolean;
          backgroundColor?: unknown;
          borderColor?: unknown;
        };
      }
    ) => {
      const c = resolveColors(val, props.fill ?? 'solid', !!props.disabled);
      return {
        // Only apply variant colors if not explicitly overridden via props
        ...(props.backgroundColor === undefined && {
          backgroundColor: c.background,
        }),
        ...(props.borderColor === undefined && { borderColor: c.border }),
      };
    },
    disabled: {
      true: {},
      false: {},
    },
    circular: {
      true: {},
      false: {},
    },
    dimmed: {
      true: { opacity: 0.5 },
    },
    iconOnly: (
      val: boolean,
      { props }: { props: { size?: ButtonSize; circular?: boolean } }
    ) => {
      if (!val) return {};
      const sizes = {
        large: { width: '$6xl', paddingHorizontal: 0 },
        medium: { width: 56, paddingHorizontal: 0 },
        small: { width: 42, paddingHorizontal: 0 },
      };
      return {
        ...sizes[props.size ?? 'medium'],
        ...(props.circular ? { borderRadius: '100%', aspectRatio: 1 } : null),
      };
    },
    hasLeadingIcon: {
      small: { paddingLeft: '$l' },
    },
    symmetricPadding: {
      small: { paddingHorizontal: '$xl' },
    },
    shadow: {
      true: {
        shadowColor: '$shadow',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.35,
        shadowRadius: 35,
        elevation: 4,
      },
    },
    glow: {
      true: {
        shadowColor: '$positiveActionText',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 10,
        elevation: 4,
      },
    },
  } as const,

  defaultVariants: {
    size: 'medium',
    fill: 'solid',
    intent: 'primary',
    disabled: false,
  },
});

// ButtonText maps ButtonSize ('large'/'medium'/'small') to TextSize ('$label/2xl' etc).
// We can't rely on Text's `trimmed` variant because it looks up trim settings using
// `props.size`, which would be a ButtonSize, not a TextSize. Instead, we disable
// Text's trimming and apply the correct trim margins directly in each size variant.
const textSize = (size: keyof typeof trimSettings) => ({
  size,
  ...(trimSettings[size] ?? {}),
});

const ButtonText = styled(Text, {
  name: 'ButtonText',
  context: ButtonContext,
  userSelect: 'none',
  color: '$secondaryText',
  trimmed: false,
  style: {
    WebkitFontSmoothing: 'antialiased',
  },
  variants: {
    size: {
      large: textSize('$label/2xl'),
      medium: textSize('$label/l'),
      small: textSize('$label/m'),
    },
    intent: (
      val: ButtonIntent,
      { props }: { props: { fill?: ButtonStyle; disabled?: boolean } }
    ) => {
      const c = resolveColors(val, props.fill ?? 'solid', !!props.disabled);
      return { color: c.foreground };
    },
    disabled: {
      true: {},
      false: {},
    },
    centered: {
      true: { textAlign: 'center' },
      false: { textAlign: 'left' },
    },
  } as const,
  defaultVariants: {
    size: 'medium',
    intent: 'primary',
    centered: false,
  },
});

type IconProp = IconType | React.ReactElement;

const renderIcon = (icon: IconProp) =>
  typeof icon === 'string' ? <ButtonIconFrame type={icon} /> : icon;

type ButtonBaseProps = Omit<
  React.ComponentProps<typeof ButtonFrame>,
  'children'
> & {
  loading?: boolean;
  // ButtonFrame variant props
  size?: ButtonSize;
  fill?: ButtonStyle;
  /** Override the intent (semantic meaning) from the preset. Use sparingly - prefer presets. */
  intent?: ButtonIntent;
  /** @deprecated Use `preset` or `intent` instead */
  type?: ButtonIntent;
  disabled?: boolean;
  dimmed?: boolean;
  shadow?: boolean;
  glow?: boolean;
  // Additional props
  centered?: boolean;
  /** Disable haptic feedback on press. */
  disableHaptic?: boolean;
  /** Preset configuration that sets intent, fill, and optionally size. Individual props override preset values. */
  preset?: ButtonPreset;
};

type TextButtonProps = ButtonBaseProps & {
  label: string;
  leadingIcon?: IconProp;
  trailingIcon?: IconProp;
  icon?: never;
};

type IconOnlyButtonProps = ButtonBaseProps & {
  icon: IconProp;
  circular?: boolean;
  label?: never;
  leadingIcon?: never;
  trailingIcon?: never;
};

export type ButtonProps = TextButtonProps | IconOnlyButtonProps;
type ButtonPressEvent = Parameters<NonNullable<ButtonBaseProps['onPress']>>[0];

const ButtonImpl = React.forwardRef<
  React.ElementRef<typeof ButtonFrame>,
  ButtonProps
>(function ButtonImpl(
  {
    label,
    icon,
    leadingIcon,
    trailingIcon,
    loading = false,
    disabled = false,
    size: sizeProp,
    fill: fillProp,
    intent: intentProp,
    type: typeProp,
    preset,
    centered: centeredProp,
    shadow = false,
    glow = false,
    disableHaptic,
    onPress,
    ...props
  },
  ref
) {
  // Apply preset values, allowing individual props to override
  const presetConfig = preset ? presetConfigs[preset] : undefined;
  const size = sizeProp ?? presetConfig?.size ?? 'medium';
  const fill = fillProp ?? presetConfig?.fill ?? 'solid';
  const intent = intentProp ?? typeProp ?? presetConfig?.intent ?? 'primary';
  const centered = centeredProp ?? presetConfig?.centered ?? false;

  const isInteractive = !disabled && !loading;
  const isIconOnly = !!icon;

  const handlePress = React.useCallback(
    (e: ButtonPressEvent) => {
      if (disabled) return;
      if (!disableHaptic) {
        triggerHaptic('baseButtonClick');
      }
      onPress?.(e);
    },
    [disabled, disableHaptic, onPress]
  );

  const leading = React.useMemo(
    () => leadingIcon && renderIcon(leadingIcon),
    [leadingIcon]
  );

  const trailing = React.useMemo(
    () =>
      loading ? <ButtonSpinner /> : trailingIcon && renderIcon(trailingIcon),
    [loading, trailingIcon]
  );

  const iconContent = React.useMemo(
    () => (loading ? <ButtonSpinner /> : icon && renderIcon(icon)),
    [loading, icon]
  );

  return (
    <ButtonContext.Provider
      size={size}
      fill={fill}
      intent={intent}
      disabled={disabled}
    >
      <ButtonFrame
        ref={ref}
        size={size}
        fill={fill}
        intent={intent}
        iconOnly={isIconOnly}
        hasLeadingIcon={leadingIcon && size === 'small' ? 'small' : undefined}
        symmetricPadding={
          size === 'small' && !leadingIcon && (centered || !trailing)
            ? 'small'
            : undefined
        }
        pointerEvents={isInteractive ? 'auto' : 'none'}
        disabled={disabled}
        dimmed={disabled && fill !== 'solid'}
        shadow={shadow}
        glow={glow}
        {...props}
        onPress={handlePress}
      >
        {isIconOnly ? (
          iconContent
        ) : (
          <>
            {leading}
            {label && (
              <ButtonText
                size={fill === 'text' ? 'medium' : size}
                centered={centered}
              >
                {label}
              </ButtonText>
            )}
            {trailing}
          </>
        )}
      </ButtonFrame>
    </ButtonContext.Provider>
  );
});

const ButtonIconFrame = styled(Icon, {
  name: 'ButtonIcon',
  context: ButtonContext,
  customSize: ['$2xl', '$2xl'],
  color: '$secondaryText',
  variants: {
    intent: (
      val: ButtonIntent,
      { props }: { props: { fill?: ButtonStyle; disabled?: boolean } }
    ) => {
      const c = resolveColors(val, props.fill ?? 'solid', !!props.disabled);
      return { color: c.foreground };
    },
  } as const,
});

function ButtonSpinner({
  intent = 'primary',
  fill = 'solid',
  disabled = false,
}: {
  intent?: ButtonIntent;
  fill?: ButtonStyle;
  disabled?: boolean;
}) {
  const context = ButtonContext.useStyledContext();
  const resolvedIntent = context.intent ?? intent;
  const resolvedFill = context.fill ?? fill;
  const resolvedDisabled = context.disabled ?? disabled;

  const color = resolveColors(
    resolvedIntent,
    resolvedFill,
    resolvedDisabled
  ).foreground;

  return <LoadingSpinner size="small" color={color as ColorTokens} />;
}

// Wrapper to prevent passing `preset` to Frame (presets are only resolved in ButtonImpl)
type ButtonFrameProps = Omit<
  React.ComponentProps<typeof ButtonFrame>,
  'preset'
>;
const TypedButtonFrame = ButtonFrame as React.ComponentType<ButtonFrameProps>;

export const Button = withStaticProperties(ButtonImpl, {
  /** Use Button.Frame and Button.Text to build a custom button with similar visual treatment to Button.
   * Note: `preset` is not supported on Frame - use `fill` and `intent` props directly. */
  Frame: TypedButtonFrame,
  /** Use Button.Frame and Button.Text to build a custom button with similar visual treatment to Button */
  Text: ButtonText,
});
