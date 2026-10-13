import React, { ComponentProps, useMemo } from 'react';
import { Platform } from 'react-native';
import { Text as TamaguiText, TextStyle, YStack, isWeb, styled } from 'tamagui';

import { trimOverrides } from './trimOverrides';
import { trimAndroid, trimIos, trimWeb } from './trimSettings';

type TrimTable = typeof trimIos;

function withOverrides(
  table: TrimTable,
  overrides: Partial<Record<keyof TrimTable, TextStyle>>
): TrimTable {
  const result = { ...table };
  for (const [size, style] of Object.entries(overrides)) {
    const key = size as keyof TrimTable;
    result[key] = { ...result[key], ...style } as TrimTable[typeof key];
  }
  return result;
}

// The Tamagui compiler evaluates this module with react-native swapped for its
// web build, so Platform.OS reads 'web' while it flattens text for iOS and
// Android; isWeb stays correct there. Flattened text therefore gets the iOS
// trims on both, and the Android build swaps them via
// packages/ui/babel/androidTextStyles.cjs.
export const trimSettings = isWeb
  ? trimWeb
  : Platform.OS === 'android'
    ? withOverrides(trimAndroid, trimOverrides.android)
    : withOverrides(trimIos, trimOverrides.ios);

export const RawText = styled(TamaguiText, {
  name: 'RawText',
  unstyled: true,
  color: 'unset',
});

export const mobileTypeStyles = {
  '$mono/s': {
    fontFamily: '$mono',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    fontWeight: '500',
  },
  '$mono/m': {
    fontFamily: '$mono',
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0,
  },
  '$emoji/m': {
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: -0.264,
  },
  '$emoji/l': {
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.396,
  },
  '$label/s': {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    fontWeight: '400',
  },
  '$label/m': {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.187,
    fontWeight: '400',
  },
  '$label/l': {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.2,
    fontWeight: '400',
  },
  '$label/xl': {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
    fontWeight: '400',
  },
  '$label/2xl': {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
    fontWeight: '500',
  },
  '$label/3xl': {
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: -0.408,
  },
  $body: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.032,
    fontWeight: '400',
  },
  '$title/l': {
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: -0.374,
    fontWeight: '400',
  },
} as const satisfies Record<string, TextStyle>;

export const desktopTypeStyles = {
  '$mono/s': {
    fontFamily: '$mono',
    fontSize: 10,
    lineHeight: 17,
    letterSpacing: 0,
    fontWeight: '500',
  },
  '$mono/m': {
    fontFamily: '$mono',
    fontSize: 12,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: 0,
  },
  '$emoji/m': {
    fontSize: 17,
    lineHeight: 19,
    letterSpacing: -0.264,
  },
  '$emoji/l': {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.396,
  },
  '$label/s': {
    fontSize: 10.5,
    lineHeight: 13.333,
    letterSpacing: 0,
    fontWeight: '400',
  },
  '$label/m': {
    fontSize: 12.5,
    lineHeight: 17,
    letterSpacing: -0.187,
    fontWeight: '400',
  },
  '$label/l': {
    fontSize: 14.5,
    lineHeight: 21,
    letterSpacing: -0.2,
    fontWeight: '400',
  },
  '$label/xl': {
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: -0.2,
    fontWeight: '400',
  },
  '$label/2xl': {
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: -0.2,
    fontWeight: '500',
  },
  '$label/3xl': {
    fontSize: 18.5,
    lineHeight: 20,
    letterSpacing: -0.408,
  },
  $body: {
    fontSize: 14.5,
    lineHeight: 21,
    letterSpacing: -0.032,
    fontWeight: '400',
  },
  '$title/l': {
    fontSize: 31,
    lineHeight: 31,
    letterSpacing: -0.374,
    fontWeight: '400',
  },
} as const satisfies Record<string, TextStyle>;

export type FontStyle = keyof typeof trimAndroid;
export type TextSize = keyof typeof mobileTypeStyles;
export type TextProps = ComponentProps<typeof Text>;

const variants = Object.entries(mobileTypeStyles).reduce(
  (variants, [key, value]) => {
    variants[key as TextSize] = {
      ...value,
      $gtSm: desktopTypeStyles[key as TextSize],
    };
    return variants;
  },
  {} as Record<TextSize, TextStyle>
);

export const Text = styled(RawText, {
  name: 'TlonText',
  color: '$primaryText',
  variants: {
    size: variants,
    trimmed: (value: boolean, { props }) => {
      if (!value) return {};
      return trimSettings[(props as { size: TextSize }).size] ?? {};
    },
  } as const,
  defaultVariants: {
    trimmed: true,
  },
});

const BaseParagraph = styled(YStack, {
  name: 'Paragraph',
  variants: {
    trimmed: (value: boolean, { props }) => {
      if (!value) return {};
      return trimSettings[(props as { size: TextSize }).size] ?? {};
    },
  } as const,
});

export const Paragraph = ({
  trimmed,
  children,
  ...props
}: ComponentProps<typeof BaseParagraph> & {
  size: TextSize;
  trimmed?: boolean;
}) => {
  const content = useMemo(() => {
    if (!trimmed) {
      return children;
    } else {
      return React.Children.map(children, (c) => {
        return React.cloneElement(c, { trimmed: false });
      });
    }
  }, [trimmed, children]);
  return (
    <BaseParagraph trimmed {...props}>
      {content}
    </BaseParagraph>
  );
};
