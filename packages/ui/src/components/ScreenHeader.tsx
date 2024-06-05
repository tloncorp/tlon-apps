import { BlurView } from 'expo-blur';
import { PropsWithChildren, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styled, useTheme, withStaticProperties } from 'tamagui';

import { ChevronLeft } from '../assets/icons';
import { SizableText, View, XStack } from '../core';
import { IconButton } from './IconButton';

export const ScreenHeaderComponent = ({
  children,
  title,
  leftControls,
  rightControls,
}: PropsWithChildren<{
  title?: string | ReactNode;
  leftControls?: ReactNode | null;
  rightControls?: ReactNode | null;
}>) => {
  const { top } = useSafeAreaInsets();
  return (
    <View paddingTop={top} zIndex={50} backgroundColor="$background">
      <XStack height="$3xl" paddingHorizontal="$2xl" alignItems="center">
        {typeof title === 'string' ? <HeaderTitle>{title}</HeaderTitle> : title}
        <HeaderControls side="left">{leftControls}</HeaderControls>
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
  size: '$m',
  textAlign: 'left',
  fontWeight: '500',
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

function BlurOnIos(props: PropsWithChildren) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        style={{ paddingTop: insets.top }}
        intensity={75}
        tint={theme.isDark ? 'dark' : 'light'}
      >
        {props.children}
      </BlurView>
    );
  }
  return (
    <View backgroundColor="$background" paddingTop={insets.top}>
      {props.children}
    </View>
  );
}
