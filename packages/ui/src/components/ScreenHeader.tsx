import { useCurrentSession } from '@tloncorp/shared';
import { PropsWithChildren, ReactNode } from 'react';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, isWeb, styled, withStaticProperties } from 'tamagui';

import { Icon } from './Icon';
import { Text } from './TextV2';

export const ScreenHeaderComponent = ({
  children,
  title,
  leftControls,
  rightControls,
  isLoading,
  backAction,
  showSessionStatus,
}: PropsWithChildren<{
  title?: string | ReactNode;
  leftControls?: ReactNode | null;
  rightControls?: ReactNode | null;
  isLoading?: boolean;
  backAction?: () => void;
  showSessionStatus?: boolean;
}>) => {
  const { top } = useSafeAreaInsets();
  const resolvedTitle = isLoading ? 'Loading…' : title;
  const currentSession = useCurrentSession();
  const textColor =
    showSessionStatus === false
      ? '$primaryText'
      : currentSession
        ? '$primaryText'
        : '$tertiaryText';

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
            <HeaderTitle color={textColor}>{resolvedTitle}</HeaderTitle>
          ) : (
            <Animated.View
              key={title}
              entering={FadeInDown}
              exiting={FadeOutUp}
              style={{ flex: 1 }}
            >
              <HeaderTitle color={textColor}>{resolvedTitle}</HeaderTitle>
            </Animated.View>
          )
        ) : (
          resolvedTitle
        )}
        <HeaderControls side="left">
          {backAction ? <HeaderBackButton onPress={backAction} /> : null}
          {leftControls}
        </HeaderControls>
        <HeaderControls side="right">{rightControls}</HeaderControls>
        {children}
      </XStack>
    </View>
  );
};

const HeaderIconButton = styled(Icon, {
  customSize: ['$3xl', '$2xl'],
  borderRadius: '$m',
  pressStyle: {
    opacity: 0.5,
  },
});

const HeaderTextButton = styled(Text, {
  size: '$label/2xl',
  paddingHorizontal: '$s',
  pressStyle: {
    opacity: 0.5,
  },
});

const HeaderBackButton = ({ onPress }: { onPress?: () => void }) => {
  return <HeaderIconButton type="ChevronLeft" onPress={onPress} />;
};

const HeaderTitle = styled(Text, {
  size: '$label/2xl',
  textAlign: 'center',
  width: '100%',
});

const HeaderControls = styled(XStack, {
  position: 'absolute',
  top: 0,
  bottom: 0,
  gap: '$xl',
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
  IconButton: HeaderIconButton,
  TextButton: HeaderTextButton,
});
