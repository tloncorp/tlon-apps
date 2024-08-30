import React, { ComponentProps, useMemo } from 'react';
import { Platform } from 'react-native';
import { Text as TamaguiText, TextStyle, YStack, styled } from 'tamagui';

import { trimAndroid, trimIos } from './trimSettings';

// Emoji are in general larger than text, so we need to adjust the margin Do it
// here so we can still copy/paste above. This logic could also be moved to the
// fixture itself.
trimIos['$emoji/l'].marginBottom = 0;
trimAndroid['$emoji/l'].marginBottom = -2;

const trimSettings = Platform.OS === 'ios' ? trimIos : trimAndroid;

export const RawText = styled(TamaguiText, {
  name: 'RawText',
  unstyled: true,
  color: 'unset',
});

export const typeStyles = {
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
    fontWeight: '500',
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
};

export type FontStyle = keyof typeof trimAndroid;
export type TextSize = keyof typeof typeStyles;
export type TextProps = ComponentProps<typeof Text>;

export const Text = styled(RawText, {
  name: 'TlonText',
  color: '$primaryText',
  variants: {
    size: typeStyles as Record<keyof typeof trimSettings, TextStyle>,
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
