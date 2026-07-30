import { Icon, Text, Pressable as TlonPressable } from '@tloncorp/ui';
import { PropsWithChildren, ReactNode } from 'react';
import { ColorTokens, XStack, styled } from 'tamagui';

export const HeaderIconButton = styled(Icon, {
  customSize: ['$3xl', '$2xl'],
  borderRadius: '$m',
  cursor: 'pointer',
  pressStyle: {
    opacity: 0.5,
  },
});

export function HeaderTextButton({
  children,
  color = '$primaryText',
  disabled,
  onPress,
  testID,
}: PropsWithChildren<{
  color?: ColorTokens;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}>) {
  return (
    <TlonPressable
      accessibilityRole="button"
      alignItems="center"
      cursor={disabled ? 'default' : 'pointer'}
      disabled={disabled}
      height="$4xl"
      justifyContent="center"
      onPress={disabled ? undefined : onPress}
      paddingHorizontal="$s"
      paddingTop="$xs"
      testID={testID}
    >
      <Text size="$label/2xl" color={disabled ? '$tertiaryText' : color}>
        {children}
      </Text>
    </TlonPressable>
  );
}

export const HeaderBackButton = ({ onPress }: { onPress?: () => void }) => {
  return (
    <HeaderIconButton
      testID="HeaderBackButton"
      type="ChevronLeft"
      onPress={onPress}
    />
  );
};

export const HeaderTitleText = styled(Text, {
  size: '$label/2xl',
  numberOfLines: 1,
});

export const HeaderControls = styled(XStack, {
  position: 'absolute',
  bottom: 0,
  height: '$4xl',
  alignItems: 'center',
  gap: '$l',
  zIndex: 1,
  variants: {
    side: {
      left: {
        left: '$xl',
      },
      right: {
        right: '$xl',
      },
    },
  } as const,
});

export type HeaderControlProps = {
  children?: ReactNode;
  color?: ColorTokens;
  disabled?: boolean;
  onPress?: () => void;
  side?: 'left' | 'right';
  testID?: string;
  type?: string;
  accessibilityLabel?: string;
  'aria-label'?: string;
};
