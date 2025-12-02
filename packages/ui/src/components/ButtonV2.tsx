import React from 'react';
import { ColorTokens, styled, withStaticProperties } from 'tamagui';

import { Icon, IconType } from './Icon';
import { LoadingSpinner } from './LoadingSpinner';
import Pressable from './Pressable';
import { Text } from './TextV2';

export type ButtonSize = 'large' | 'medium' | 'small';
export type ButtonStyle = 'solid' | 'outline' | 'ghost' | 'text';
export type ButtonRole =
  | 'primary'
  | 'secondary'
  | 'helper'
  | 'positive'
  | 'negative';

const roleColors = {
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
} as const;

function getColors(style: ButtonStyle, role: ButtonRole) {
  const c = roleColors[role];
  switch (style) {
    case 'solid':
      return {
        background: c.action,
        border: c.action,
        foreground: role === 'secondary' ? '$tertiaryText' : '$background',
      };
    case 'outline':
      return {
        background: c.background,
        border: role === 'primary' ? '$primaryText' : c.border,
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

function getDisabledColors(role: ButtonRole) {
  const border =
    role === 'primary' || role === 'secondary'
      ? '$border'
      : roleColors[role].border;
  return { background: border, border, foreground: '$tertiaryText' };
}

const ButtonFrame = styled(Pressable, {
  name: 'Button',
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
        height: 42,
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
      text: { borderWidth: 0, height: 'auto', paddingHorizontal: 0, paddingVertical: 0 },
    },
    dimmed: {
      true: { opacity: 0.5 },
    },
    iconOnly: {
      large: { width: '$6xl', paddingHorizontal: 0 },
      medium: { width: 56, paddingHorizontal: 0 },
      small: { width: 42, paddingHorizontal: 0 },
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
  },
});

const ButtonText = styled(Text, {
  name: 'ButtonText',
  userSelect: 'none',
  style: {
    WebkitFontSmoothing: 'antialiased',
  },
  variants: {
    buttonSize: {
      large: { size: '$label/2xl' },
      medium: { size: '$label/l' },
      small: { size: '$label/m' },
    },
    centered: {
      true: { flex: 0, textAlign: 'center' },
      false: { flex: 1, textAlign: 'left' },
    },
  } as const,
  defaultVariants: {
    buttonSize: 'medium',
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
  type?: ButtonRole;
  centered?: boolean;
  shadow?: boolean;
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
  ...props
}: ButtonProps) {
  const isInteractive = !disabled && !loading;
  const colors =
    disabled && fill === 'solid'
      ? getDisabledColors(type)
      : getColors(fill, type);

  const renderIcon = (icon: IconProp) =>
    typeof icon === 'string' ? (
      <Icon
        type={icon}
        customSize={['$2xl', '$2xl']}
        color={colors.foreground as ColorTokens}
      />
    ) : (
      React.cloneElement(icon, { color: colors.foreground })
    );

  const trailing = loading ? (
    <LoadingSpinner size="small" color={colors.foreground as ColorTokens} />
  ) : trailingIcon ? (
    renderIcon(trailingIcon)
  ) : null;

  const hasOnlyTrailing = !label && !leadingIcon && trailing;

  return (
    <ButtonFrame
      size={size}
      fill={fill}
      iconOnly={hasOnlyTrailing ? size : undefined}
      hasLeadingIcon={leadingIcon && size === 'small' ? 'small' : undefined}
      symmetricPadding={size === 'small' && (centered || !trailing) ? 'small' : undefined}
      disabled={!isInteractive}
      dimmed={disabled && fill !== 'solid'}
      shadow={shadow}
      backgroundColor={colors.background}
      borderColor={colors.border}
      {...props}
    >
      {leadingIcon && renderIcon(leadingIcon)}
      {label && (
        <ButtonText
          buttonSize={fill === 'text' ? 'medium' : size}
          centered={fill === 'text' ? false : !!hasOnlyTrailing || centered}
          color={colors.foreground as ColorTokens}
        >
          {label}
        </ButtonText>
      )}
      {trailing}
    </ButtonFrame>
  );
}

export const Button = withStaticProperties(ButtonImpl, {
  Frame: ButtonFrame,
  Text: ButtonText,
});
