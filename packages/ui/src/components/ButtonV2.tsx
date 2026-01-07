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
import { Text } from './TextV2';

export type ButtonSize = 'large' | 'medium' | 'small';
export type ButtonStyle = 'solid' | 'outline' | 'ghost' | 'text';
export type ButtonIntent =
  | 'primary'
  | 'secondary'
  | 'helper'
  | 'positive'
  | 'negative'
  | 'notice';

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
  [k: string]: { [k: string]: ButtonColor };
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
        foreground:
          intent === 'secondary'
            ? '$tertiaryText'
            : intent === 'notice'
              ? '$systemNoticeBackground'
              : '$background',
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
    dimmed: {
      true: { opacity: 0.5 },
    },
    iconOnly: (val: boolean, { props }: { props: { size?: ButtonSize } }) => {
      if (!val) return {};
      const sizes = {
        large: { width: '$6xl', paddingHorizontal: 0 },
        medium: { width: 56, paddingHorizontal: 0 },
        small: { width: 42, paddingHorizontal: 0 },
      };
      return sizes[props.size ?? 'medium'];
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
  } as const,

  defaultVariants: {
    size: 'medium',
    fill: 'solid',
    intent: 'primary',
    disabled: false,
  },
});

const ButtonText = styled(Text, {
  name: 'ButtonText',
  context: ButtonContext,
  userSelect: 'none',
  color: '$secondaryText',
  style: {
    WebkitFontSmoothing: 'antialiased',
  },
  variants: {
    size: {
      large: { size: '$label/2xl' },
      medium: { size: '$label/l' },
      small: { size: '$label/m' },
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

export type ButtonProps = Omit<
  React.ComponentProps<typeof ButtonFrame>,
  'children'
> & {
  label?: string;
  leadingIcon?: IconProp;
  trailingIcon?: IconProp;
  loading?: boolean;
  disabled?: boolean;
  size?: ButtonSize;
  fill?: ButtonStyle;
  type?: ButtonIntent;
  centered?: boolean;
  shadow?: boolean;
  /** Enable haptic feedback on press. Defaults to true. */
  haptic?: boolean;
};

function ButtonImpl({
  label,
  leadingIcon,
  trailingIcon,
  loading = false,
  disabled = false,
  size = 'medium',
  fill = 'solid',
  type = 'primary',
  centered = false,
  shadow = false,
  haptic = true,
  onPress,
  ...props
}: ButtonProps) {
  const isInteractive = !disabled && !loading;

  const handlePress = React.useCallback(
    (e: any) => {
      if (haptic) {
        triggerHaptic('baseButtonClick');
      }
      onPress?.(e);
    },
    [haptic, onPress]
  );

  const renderIcon = (icon: IconProp) =>
    typeof icon === 'string' ? <ButtonIconFrame type={icon} /> : icon;

  const trailing = loading ? (
    <ButtonSpinner />
  ) : trailingIcon ? (
    renderIcon(trailingIcon)
  ) : null;

  const hasOnlyTrailing = !label && !leadingIcon && trailing;

  return (
    <ButtonContext.Provider
      size={size}
      fill={fill}
      intent={type}
      disabled={disabled}
    >
      <ButtonFrame
        size={size}
        fill={fill}
        intent={type}
        iconOnly={!!hasOnlyTrailing}
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
        {...props}
        onPress={handlePress}
      >
        {leadingIcon && renderIcon(leadingIcon)}
        {label && (
          <ButtonText
            size={fill === 'text' ? 'medium' : size}
            centered={!!hasOnlyTrailing || centered}
          >
            {label}
          </ButtonText>
        )}
        {trailing}
      </ButtonFrame>
    </ButtonContext.Provider>
  );
}

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
    disabled: {
      true: {},
      false: {},
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

export const Button = withStaticProperties(ButtonImpl, {
  Frame: ButtonFrame,
  Text: ButtonText,
  Icon: ButtonIconFrame,
  Spinner: ButtonSpinner,
  Context: ButtonContext,
});
