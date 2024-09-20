import { useCurrentSession } from '@tloncorp/shared';
import { PropsWithChildren, ReactNode } from 'react';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SizableText,
  View,
  XStack,
  isWeb,
  styled,
  withStaticProperties,
} from 'tamagui';

import { ChevronLeft } from '../assets/icons';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
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
    <IconButton backgroundColor={'unset'} onPress={onPress}>
      <ChevronLeft />
    </IconButton>
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

export function GenericHeader({
  title,
  goBack,
  showSpinner,
  rightContent,
  showSessionStatus,
}: {
  title?: string;
  goBack?: () => void;
  showSpinner?: boolean;
  rightContent?: React.ReactNode;
  showSessionStatus?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const currentSession = useCurrentSession();
  const textColor =
    showSessionStatus === false
      ? '$primaryText'
      : currentSession
        ? '$primaryText'
        : '$tertiaryText';

  return (
    <View paddingTop={insets.top}>
      <XStack
        alignItems="center"
        gap="$m"
        height="$4xl"
        justifyContent="space-between"
        paddingHorizontal="$xl"
        paddingVertical="$m"
      >
        <XStack
          alignItems="center"
          justifyContent={!goBack ? 'center' : undefined}
          gap="$m"
          flex={1}
        >
          {goBack && (
            <Button
              onPress={goBack}
              backgroundColor="unset"
              borderColor="transparent"
            >
              <Icon type="ChevronLeft" />
            </Button>
          )}
          {isWeb ? (
            <View flex={1}>
              <SizableText
                flexShrink={1}
                numberOfLines={1}
                color={textColor}
                size="$m"
                fontWeight="$xl"
              >
                {showSpinner ? 'Loading…' : title}
              </SizableText>
            </View>
          ) : (
            <Animated.View
              entering={FadeInDown}
              exiting={FadeOutUp}
              style={{ flex: 1 }}
            >
              <SizableText
                flexShrink={1}
                numberOfLines={1}
                color={textColor}
                size="$m"
                fontWeight="$xl"
              >
                {showSpinner ? 'Loading…' : title}
              </SizableText>
            </Animated.View>
          )}
        </XStack>
        <XStack gap="$m" alignItems="center">
          {rightContent}
        </XStack>
      </XStack>
    </View>
  );
}
