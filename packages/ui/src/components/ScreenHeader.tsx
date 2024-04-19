import { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styled, withStaticProperties } from 'tamagui';

import { ChevronLeft } from '../assets/icons';
import { SizableText, View, XStack } from '../core';
import { IconButton } from './IconButton';

export const ScreenHeaderComponent = ({
  children,
  title,
  leftControls,
  rightControls,
}: PropsWithChildren<{
  title?: string;
  leftControls?: ReactNode | null;
  rightControls?: ReactNode | null;
}>) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      paddingTop={insets.top}
      borderBottomWidth={1}
      borderBottomColor={'$border'}
    >
      <XStack
        height="$4xl"
        paddingVertical="$m"
        paddingHorizontal="$xl"
        alignItems="center"
      >
        <HeaderControls side="left">{leftControls}</HeaderControls>
        <HeaderTitle lineHeight={0}>{title}</HeaderTitle>
        <HeaderControls side="right">{rightControls}</HeaderControls>
        {children}
      </XStack>
    </View>
  );
};

const HeaderBackButton = ({ onPress }: { onPress?: () => void }) => {
  return (
    <IconButton onPress={onPress}>
      <ChevronLeft />
    </IconButton>
  );
};

const HeaderTitle = styled(SizableText, {
  size: '$l',
  textAlign: 'center',
  flex: 1,
});

const HeaderControls = styled(XStack, {
  position: 'absolute',
  top: '$m',
  bottom: 0,
  height: '100%',
  gap: '$m',
  alignItems: 'center',
  variants: {
    side: {
      left: {
        left: '$xl',
        justifyContent: 'flex-start',
      },
      right: {
        right: '$xl',
        justifyContent: 'flex-end',
      },
    },
  } as const,
});

export const ScreenHeader = withStaticProperties(ScreenHeaderComponent, {
  Controls: HeaderControls,
  Title: HeaderTitle,
  BackButton: HeaderBackButton,
});
