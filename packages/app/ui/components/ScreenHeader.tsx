import { useDebouncedValue } from '@tloncorp/shared';
import { Icon, Text, View } from '@tloncorp/ui';
import { Children, PropsWithChildren, ReactNode } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, styled, withStaticProperties } from 'tamagui';

export const ScreenHeaderComponent = ({
  children,
  title,
  titleIcon,
  subtitle,
  showSubtitle = false,
  leftControls,
  rightControls,
  isLoading,
  backAction,
  borderBottom,
  onTitlePress,
  useHorizontalTitleLayout = false,
}: PropsWithChildren<{
  title?: string | ReactNode;
  titleIcon?: ReactNode;
  subtitle?: string | ReactNode;
  showSubtitle?: boolean;
  leftControls?: ReactNode | null;
  rightControls?: ReactNode | null;
  isLoading?: boolean;
  backAction?: () => void;
  showSessionStatus?: boolean;
  borderBottom?: boolean;
  onTitlePress?: () => void;
  useHorizontalTitleLayout?: boolean;
}>) => {
  const { top } = useSafeAreaInsets();
  const resolvedSubtitle = useDebouncedValue(
    isLoading ? 'Loading…' : subtitle,
    200
  );

  const leftControlsCount = leftControls ? Children.count(leftControls) : 0;
  const backButtonCount = backAction ? 1 : 0;

  const horizontalTitleStack: ViewStyle = {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
    paddingLeft: 18 + leftControlsCount * 28 + backButtonCount * 28,
    alignItems: 'center',
  };

  const getWrapperStyle = () => {
    if (useHorizontalTitleLayout) {
      return horizontalTitleStack;
    }
  };

  const renderTitleWrapper = (children: ReactNode) => {
    const wrapperStyle = getWrapperStyle();
    if (onTitlePress) {
      return (
        <Pressable style={wrapperStyle} onPress={onTitlePress}>
          {children}
        </Pressable>
      );
    }
    return <View style={wrapperStyle}>{children}</View>;
  };

  return (
    <View
      paddingTop={top}
      zIndex={50}
      backgroundColor={'$background'}
      borderColor="$border"
      borderBottomWidth={borderBottom ? 1 : 0}
    >
      {renderTitleWrapper(
        <>
          {showSubtitle && (
            <View
              height={useHorizontalTitleLayout ? '$4xl' : '$xl'}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={useHorizontalTitleLayout ? '$l' : '$2xl'}
            >
              <Text
                color={'$secondaryText'}
                size="$label/s"
                numberOfLines={1}
                paddingTop={useHorizontalTitleLayout ? 5 : undefined}
              >
                {resolvedSubtitle}
              </Text>
            </View>
          )}
          <XStack
            alignItems="center"
            justifyContent="center"
            gap={'$s'}
            height={'$4xl'}
          >
            {titleIcon}
            <Text
              size={'$label/2xl'}
              color={'$primaryText'}
              numberOfLines={1}
              maxWidth={useHorizontalTitleLayout ? 'unset' : 185}
            >
              {title}
            </Text>
            {onTitlePress && (
              <Icon type="ChevronDown" color="$primaryText" size="$s" />
            )}
          </XStack>
        </>
      )}
      <HeaderControls side="left">
        {backAction ? <HeaderBackButton onPress={backAction} /> : null}
        {leftControls}
      </HeaderControls>
      <HeaderControls flex={1} side="right">
        {rightControls}
      </HeaderControls>
      {children}
    </View>
  );
};

const HeaderIconButton = styled(Icon, {
  customSize: ['$3xl', '$2xl'],
  borderRadius: '$m',
  cursor: 'pointer',
  pressStyle: {
    opacity: 0.5,
  },
});

const HeaderTextButton = styled(Text, {
  size: '$label/2xl',
  paddingHorizontal: '$s',
  paddingVertical: '$m',
  cursor: 'pointer',
  pressStyle: {
    opacity: 0.5,
  },
  variants: {
    disabled: {
      true: {
        color: '$tertiaryText',
        cursor: 'default',
        pressStyle: {
          opacity: 1,
        },
      },
    },
  },
});

const HeaderBackButton = ({ onPress }: { onPress?: () => void }) => {
  return (
    <HeaderIconButton
      testID="HeaderBackButton"
      type="ChevronLeft"
      onPress={onPress}
    />
  );
};

const HeaderTitleText = styled(Text, {
  size: '$label/2xl',
  numberOfLines: 1,
});

const HeaderControls = styled(XStack, {
  position: 'absolute',
  bottom: '$m',
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

export const ScreenHeader = withStaticProperties(ScreenHeaderComponent, {
  Controls: HeaderControls,
  Title: HeaderTitleText,
  BackButton: HeaderBackButton,
  IconButton: HeaderIconButton,
  TextButton: HeaderTextButton,
});
