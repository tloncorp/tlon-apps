import { useDebouncedValue } from '@tloncorp/shared';
import { Icon, Text, View } from '@tloncorp/ui';
import {
  Children,
  PropsWithChildren,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import { Pressable, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  withDelay,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  XStack,
  getVariableValue,
  styled,
  useTheme,
  withStaticProperties,
} from 'tamagui';

import { LongPressDisclosure } from './LongPressDisclosure';

export const ScreenHeaderComponent = ({
  children,
  title,
  titleIcon,
  subtitle,
  showSubtitle = false,
  backgroundColor,
  leftControls,
  rightControls,
  backAction,
  borderBottom,
  onTitlePress,
  useHorizontalTitleLayout = false,
  loadingSubtitle,
  testID,
}: PropsWithChildren<{
  title?: string | ReactNode;
  titleIcon?: ReactNode;
  subtitle?: string | ReactNode;
  showSubtitle?: boolean;
  backgroundColor?: string;
  leftControls?: ReactNode | null;
  rightControls?: ReactNode | null;
  backAction?: () => void;
  showSessionStatus?: boolean;
  borderBottom?: boolean;
  onTitlePress?: () => void;
  useHorizontalTitleLayout?: boolean;
  loadingSubtitle?: string | null;
  testID?: string;
}>) => {
  const { top } = useSafeAreaInsets();

  const shouldUseAnimatedTitleLayout = typeof title === 'string';

  const activeLoadingText = loadingSubtitle ?? undefined;
  const isLoadingActive = !!activeLoadingText;
  const lastLoadingTextRef = useRef('');
  if (activeLoadingText) {
    lastLoadingTextRef.current = activeLoadingText;
  }
  const displayLoadingText = activeLoadingText ?? lastLoadingTextRef.current;

  const resolvedSubtitle = useDebouncedValue(subtitle, 200);
  const subtitleOpacity = useSharedValue(isLoadingActive ? 0 : 1);

  useEffect(() => {
    cancelAnimation(subtitleOpacity);

    if (isLoadingActive) {
      subtitleOpacity.value = withTiming(0, {
        duration: 120,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    subtitleOpacity.value = withDelay(
      68,
      withTiming(1, {
        duration: 210,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [isLoadingActive, subtitleOpacity]);

  const leftControlsCount = leftControls ? Children.count(leftControls) : 0;
  const backButtonCount = backAction ? 1 : 0;

  // Fallback for non-string titles: swap to loading subtitle while loading.
  const displayTitle =
    !useHorizontalTitleLayout && isLoadingActive && !shouldUseAnimatedTitleLayout
      ? activeLoadingText
      : title;

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

  const animatedSubtitleStyle = useAnimatedStyle(() => {
    return {
      opacity: subtitleOpacity.value,
    };
  });

  const renderTitleContent = (titleContent: ReactNode) => {
    if (onTitlePress) {
      return (
        <Pressable
          onPress={onTitlePress}
          style={{
            alignSelf: useHorizontalTitleLayout ? 'flex-start' : 'center',
          }}
        >
          {titleContent}
        </Pressable>
      );
    }
    return titleContent;
  };

  return (
    <View
      paddingTop={top}
      zIndex={50}
      backgroundColor={backgroundColor ?? '$background'}
      borderColor="$border"
      borderBottomWidth={borderBottom ? 1 : 0}
      testID={testID}
    >
      <View style={getWrapperStyle()}>
        {/* Only show subtitle on desktop/large screens */}
        {showSubtitle && useHorizontalTitleLayout && (
          <Animated.View
            pointerEvents={isLoadingActive ? 'none' : 'auto'}
            style={animatedSubtitleStyle}
          >
            <View
              height={'$4xl'}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={'$l'}
              position="relative"
            >
              {typeof resolvedSubtitle === 'string' ? (
                <LongPressDisclosure text={resolvedSubtitle}>
                  <Text
                    color={'$secondaryText'}
                    size="$label/s"
                    numberOfLines={1}
                    paddingTop={5}
                    testID={'ScreenHeaderSubtitle'}
                  >
                    {resolvedSubtitle}
                  </Text>
                </LongPressDisclosure>
              ) : (
                <Text
                  color={'$secondaryText'}
                  size="$label/s"
                  numberOfLines={1}
                  paddingTop={5}
                  testID={'ScreenHeaderSubtitle'}
                >
                  {resolvedSubtitle}
                </Text>
              )}
            </View>
          </Animated.View>
        )}
        {renderTitleContent(
          shouldUseAnimatedTitleLayout ? (
            <HeaderAnimatedCluster
              isLoading={isLoadingActive}
              leftAlignWhileLoading={useHorizontalTitleLayout}
            >
              <XStack
                alignItems="center"
                justifyContent="center"
                gap={'$s'}
                height={'$4xl'}
              >
                {titleIcon}
                <HeaderAnimatedTitle
                  title={title}
                  isLoading={isLoadingActive}
                  loadingText={displayLoadingText}
                  leftAlignLoadingText={useHorizontalTitleLayout}
                  titleMaxWidth={useHorizontalTitleLayout ? 'unset' : 185}
                  loadingTextMaxWidth={useHorizontalTitleLayout ? 'unset' : 240}
                />
                {onTitlePress && (
                  <Icon type="ChevronDown" color="$primaryText" size="$s" />
                )}
              </XStack>
            </HeaderAnimatedCluster>
          ) : (
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
                testID={'ScreenHeaderTitle'}
              >
                {displayTitle}
              </Text>
              {onTitlePress && (
                <Icon type="ChevronDown" color="$primaryText" size="$s" />
              )}
            </XStack>
          )
        )}
      </View>
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

function HeaderAnimatedCluster({
  children,
  isLoading,
  leftAlignWhileLoading = false,
}: {
  children: ReactNode;
  isLoading: boolean;
  leftAlignWhileLoading?: boolean;
}) {
  const clusterTranslateY = useSharedValue(0);
  const clusterScale = useSharedValue(1);
  const clusterWidth = useSharedValue(0);

  useEffect(() => {
    if (isLoading) {
      clusterTranslateY.value = withTiming(-9, {
        duration: 195,
        easing: Easing.out(Easing.cubic),
      });
      clusterScale.value = withTiming(0.86, {
        duration: 195,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    clusterTranslateY.value = withDelay(
      68,
      withTiming(0, {
        duration: 195,
        easing: Easing.out(Easing.cubic),
      })
    );
    clusterScale.value = withDelay(
      68,
      withTiming(1, {
        duration: 195,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [clusterScale, clusterTranslateY, isLoading]);

  const animatedClusterPositionStyle = useAnimatedStyle(() => {
    const leftScaleCompensation = leftAlignWhileLoading
      ? -((1 - clusterScale.value) * clusterWidth.value) / 2
      : 0;

    return {
      transform: [
        { translateX: leftScaleCompensation },
        { translateY: clusterTranslateY.value },
      ],
    };
  });

  const animatedClusterScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: clusterScale.value }],
    };
  });

  return (
    <Animated.View
      onLayout={(event) => {
        clusterWidth.value = event.nativeEvent.layout.width;
      }}
      style={animatedClusterPositionStyle}
    >
      <Animated.View style={animatedClusterScaleStyle}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

function HeaderAnimatedTitle({
  title,
  isLoading,
  loadingText,
  leftAlignLoadingText = false,
  titleMaxWidth,
  loadingTextMaxWidth,
}: {
  title: string;
  isLoading: boolean;
  loadingText: string;
  leftAlignLoadingText?: boolean;
  titleMaxWidth?: number | 'unset';
  loadingTextMaxWidth?: number | 'unset';
}) {
  const theme = useTheme();
  const loadingOpacity = useSharedValue(0);
  const loadingTranslateY = useSharedValue(6);
  const spinnerRotation = useSharedValue(0);
  const spinnerSize = 8;
  const spinnerGap = 6;
  const loadingRowWidth =
    typeof loadingTextMaxWidth === 'number'
      ? loadingTextMaxWidth + spinnerSize + spinnerGap
      : undefined;

  useEffect(() => {
    if (isLoading) {
      loadingOpacity.value = withTiming(1, {
        duration: 135,
        easing: Easing.out(Easing.cubic),
      });
      loadingTranslateY.value = withTiming(0, {
        duration: 165,
        easing: Easing.out(Easing.cubic),
      });
      spinnerRotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false
      );
      return;
    }

    loadingOpacity.value = withTiming(0, {
      duration: 120,
      easing: Easing.in(Easing.cubic),
    });
    loadingTranslateY.value = withTiming(-6, {
      duration: 135,
      easing: Easing.in(Easing.cubic),
    });
    cancelAnimation(spinnerRotation);
    spinnerRotation.value = 0;

    return () => {
      cancelAnimation(spinnerRotation);
      spinnerRotation.value = 0;
    };
  }, [
    isLoading,
    loadingOpacity,
    loadingTranslateY,
    spinnerRotation,
  ]);

  const animatedLoadingStyle = useAnimatedStyle(() => {
    return {
      opacity: loadingOpacity.value,
      transform: [
        {
          translateX:
            !leftAlignLoadingText && loadingRowWidth
              ? -loadingRowWidth / 2
              : 0,
        },
        { translateY: loadingTranslateY.value },
      ],
    };
  });

  const animatedSpinnerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${spinnerRotation.value}deg` }],
    };
  });

  const spinnerColor = getVariableValue(theme.secondaryText);

  return (
    <View
      height="$4xl"
      alignItems="center"
      justifyContent="center"
      overflow="visible"
    >
      <Text
        size="$label/2xl"
        color="$primaryText"
        numberOfLines={1}
        maxWidth={titleMaxWidth}
        testID="ScreenHeaderTitle"
      >
        {title}
      </Text>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 36,
            left: leftAlignLoadingText ? 0 : '50%',
            width: leftAlignLoadingText ? undefined : loadingRowWidth,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: leftAlignLoadingText ? 'flex-start' : 'center',
          },
          animatedLoadingStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: spinnerSize,
              height: spinnerSize,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: spinnerColor,
              borderTopColor: 'transparent',
              marginRight: spinnerGap,
            },
            animatedSpinnerStyle,
          ]}
        />
        <Text
          size="$label/s"
          color="$secondaryText"
          numberOfLines={1}
          maxWidth={loadingTextMaxWidth}
          testID="ScreenHeaderLoadingText"
        >
          {loadingText}
        </Text>
      </Animated.View>
    </View>
  );
}

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
