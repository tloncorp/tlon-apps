import { PropsWithChildren, ReactNode } from 'react';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isWeb, styled, withStaticProperties } from 'tamagui';
import { View, XStack } from 'tamagui';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './TextV2';

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
    <View paddingTop={top} zIndex={50}>
      <XStack
        alignItems="center"
        height="$4xl"
        paddingHorizontal="$2xl"
        paddingVertical="$l"
      >
        {typeof title === 'string' ? (
          isWeb ? (
            <HeaderTitle>{title}</HeaderTitle>
          ) : (
            <Animated.View
              key={title}
              entering={FadeInDown}
              exiting={FadeOutUp}
              style={{ flex: 1 }}
            >
              <HeaderTitle>{title}</HeaderTitle>
            </Animated.View>
          )
        ) : (
          title
        )}
        <HeaderControls side="left">{leftControls}</HeaderControls>
        <HeaderControls side="right">{rightControls}</HeaderControls>
        {children}
      </XStack>
    </View>
  );
};

const HeaderBackButton = ({ onPress }: { onPress?: () => void }) => {
  return (
    <Button onPress={onPress} backgroundColor="unset" borderColor="transparent">
      <Icon type="ChevronLeft" />
    </Button>
  );
};

const HeaderTitle = styled(Text, {
  size: '$label/2xl',
  textAlign: 'left',
  width: '100%',
});

const HeaderControls = styled(XStack, {
  position: 'absolute',
  top: 0,
  bottom: 0,
  gap: '$m',
  alignItems: 'center',
  zIndex: 1,
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
