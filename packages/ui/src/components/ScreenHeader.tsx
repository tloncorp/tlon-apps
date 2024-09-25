import { useCurrentSession } from '@tloncorp/shared';
import {
  ComponentProps,
  PropsWithChildren,
  ReactNode,
  useEffect,
  useState,
} from 'react';
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
        {typeof resolvedTitle === 'string' ? (
          <HeaderTitle title={resolvedTitle} color={textColor} />
        ) : (
          resolvedTitle
        )}
        <HeaderControls side="left">
          {backAction ? <HeaderBackButton onPress={backAction} /> : null}
          {leftControls}
        </HeaderControls>
        <HeaderControls flex={1} side="right">
          {rightControls}
        </HeaderControls>
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

const HeaderTitleText = styled(Text, {
  size: '$label/2xl',
  textAlign: 'center',
  width: '100%',
  paddingHorizontal: '$2xl',
  numberOfLines: 1,
});

function HeaderTitle({
  title,
  ...props
}: {
  title: string;
} & ComponentProps<typeof HeaderTitleText>) {
  const hasMounted = useHasMounted();
  const renderedTitle = <HeaderTitleText {...props}>{title}</HeaderTitleText>;

  return isWeb ? (
    renderedTitle
  ) : (
    <Animated.View
      key={title}
      // We only want the animation to trigger when the title changes, not when
      // it first enters.
      entering={hasMounted ? FadeInDown : undefined}
      exiting={FadeOutUp}
      style={{ flex: 1 }}
    >
      {renderedTitle}
    </Animated.View>
  );
}
function useHasMounted() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return hasMounted;
}

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
  Title: HeaderTitleText,
  BackButton: HeaderBackButton,
  IconButton: HeaderIconButton,
  TextButton: HeaderTextButton,
});
