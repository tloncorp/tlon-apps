import { useDebouncedValue } from '@tloncorp/shared';
import { Icon, Text, View } from '@tloncorp/ui';
import {
  Children,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  XStack,
  getVariableValue,
  useTheme,
  withStaticProperties,
} from 'tamagui';

import { LongPressDisclosure } from '../LongPressDisclosure';
import type { ScreenHeaderAction } from './actions';
import {
  HeaderBackButton,
  HeaderControls,
  HeaderIconButton,
  HeaderTextButton,
  HeaderTitleText,
  ScreenHeaderItemElements,
} from './primitives';
import { useNativeHeader } from './useNativeHeader';

interface SharedScreenHeaderProps {
  title?: string | ReactNode;
  titleIcon?: ReactNode;
  subtitle?: string | ReactNode;
  showSubtitle?: boolean;
  backgroundColor?: string;
  leftActions?: ScreenHeaderAction[];
  rightActions?: ScreenHeaderAction[];
  backAction?: () => void;
  backDisabled?: boolean;
  borderBottom?: boolean;
  onTitlePress?: () => void;
  useHorizontalTitleLayout?: boolean;
  includeTopSafeArea?: boolean;
  loadingSubtitle?: string | null;
  testID?: string;
}

type ScreenHeaderProps = SharedScreenHeaderProps &
  (
    | {
        placement?: 'content';
        children?: ReactNode;
        leftControls?: ReactNode | null;
        rightControls?: ReactNode | null;
      }
    | {
        placement: 'navigation';
        children?: never;
        leftControls?: never;
        rightControls?: never;
      }
  );

const InlineScreenHeaderContext = createContext(false);
const androidNativeTitleHeight = 56;

export const InlineScreenHeaderProvider = InlineScreenHeaderContext.Provider;

export const ScreenHeaderComponent = ({
  children,
  title,
  titleIcon,
  subtitle,
  showSubtitle = false,
  backgroundColor,
  leftControls,
  rightControls,
  leftActions,
  rightActions,
  backAction,
  backDisabled = false,
  borderBottom,
  onTitlePress,
  useHorizontalTitleLayout = false,
  includeTopSafeArea = true,
  loadingSubtitle,
  testID,
  placement = 'content',
}: ScreenHeaderProps) => {
  const forceInline = useContext(InlineScreenHeaderContext);
  const { top } = useSafeAreaInsets();
  const [headerWidth, setHeaderWidth] = useState(0);
  const [leftControlsWidth, setLeftControlsWidth] = useState(0);
  const [rightControlsWidth, setRightControlsWidth] = useState(0);

  const shouldUseAnimatedTitleLayout = typeof title === 'string';
  const nativeTitleHeight =
    Platform.OS === 'android' &&
    placement === 'navigation' &&
    !forceInline &&
    loadingSubtitle !== undefined &&
    shouldUseAnimatedTitleLayout
      ? androidNativeTitleHeight
      : undefined;
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
  const horizontalTitleLeftOffset = Math.max(
    18 + leftControlsCount * 28 + backButtonCount * 28,
    leftControlsWidth ? leftControlsWidth + 18 : 0
  );
  const horizontalTitleRightOffset = rightControlsWidth
    ? rightControlsWidth + 18
    : 0;
  const horizontalTitleMaxWidth =
    useHorizontalTitleLayout && headerWidth
      ? Math.max(
          80,
          headerWidth - horizontalTitleLeftOffset - horizontalTitleRightOffset
        )
      : undefined;
  const centeredTitleSideOffset = Math.max(
    horizontalTitleLeftOffset,
    horizontalTitleRightOffset
  );
  const centeredTitleMaxWidth = headerWidth
    ? Math.max(80, Math.min(185, headerWidth - centeredTitleSideOffset * 2))
    : 185;
  const titleMaxWidth = useHorizontalTitleLayout
    ? horizontalTitleMaxWidth
    : centeredTitleMaxWidth;
  const loadingTextMaxWidth = useHorizontalTitleLayout ? 360 : 240;

  // Fallback for non-string titles: swap to loading subtitle while loading.
  const displayTitle =
    !useHorizontalTitleLayout &&
    isLoadingActive &&
    !shouldUseAnimatedTitleLayout
      ? activeLoadingText
      : title;

  const horizontalTitleStack: ViewStyle = {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
    paddingLeft: horizontalTitleLeftOffset,
    paddingRight: horizontalTitleRightOffset,
    alignItems: 'center',
  };

  const animatedSubtitleStyle = useAnimatedStyle(() => {
    return {
      opacity: subtitleOpacity.value,
    };
  });

  const subtitleContent = (
    <Text
      color="$secondaryText"
      size="$label/s"
      numberOfLines={1}
      testID="ScreenHeaderSubtitle"
    >
      {resolvedSubtitle}
    </Text>
  );

  const subtitleWithDisclosure =
    typeof resolvedSubtitle === 'string' ? (
      <LongPressDisclosure text={resolvedSubtitle}>
        {subtitleContent}
      </LongPressDisclosure>
    ) : (
      subtitleContent
    );

  const titleCluster = (
    <XStack
      alignItems="center"
      justifyContent="center"
      gap="$s"
      height={nativeTitleHeight ?? '$4xl'}
    >
      {titleIcon}
      {shouldUseAnimatedTitleLayout ? (
        <HeaderAnimatedTitle
          title={title}
          isLoading={isLoadingActive}
          loadingText={displayLoadingText}
          leftAlignLoadingText={useHorizontalTitleLayout}
          titleMaxWidth={titleMaxWidth}
          loadingTextMaxWidth={loadingTextMaxWidth}
          titleHeight={nativeTitleHeight}
        />
      ) : (
        <Text
          size="$label/2xl"
          color="$primaryText"
          numberOfLines={1}
          maxWidth={titleMaxWidth}
          testID="ScreenHeaderTitle"
        >
          {displayTitle}
        </Text>
      )}
      {onTitlePress && (
        <Icon type="ChevronDown" color="$primaryText" size="$s" />
      )}
    </XStack>
  );

  const titleContent = shouldUseAnimatedTitleLayout ? (
    <HeaderAnimatedCluster
      isLoading={isLoadingActive}
      leftAlignWhileLoading={useHorizontalTitleLayout}
    >
      {titleCluster}
    </HeaderAnimatedCluster>
  ) : (
    titleCluster
  );

  const interactiveTitleContent = onTitlePress ? (
    <Pressable
      onPress={onTitlePress}
      style={{
        alignSelf: useHorizontalTitleLayout ? 'flex-start' : 'center',
      }}
    >
      {titleContent}
    </Pressable>
  ) : (
    titleContent
  );

  const navigationLeftActions: ScreenHeaderAction[] = [
    ...(backAction
      ? [
          {
            id: 'screen-header-back',
            icon: 'ChevronLeft' as const,
            label: 'Back',
            onPress: backAction,
            disabled: backDisabled,
          },
        ]
      : []),
    ...(leftActions ?? []),
  ];
  // Ordinary subtitles belong to the content/desktop layout. Native custom
  // titles are reserved for elements the native string title cannot express.
  const usesCustomNativeTitle =
    typeof title !== 'string' ||
    titleIcon != null ||
    onTitlePress != null ||
    loadingSubtitle !== undefined;
  const shouldUseNativeHeader = useNativeHeader({
    enabled: placement === 'navigation' && !forceInline,
    title: typeof title === 'string' ? title : '',
    titleElement: interactiveTitleContent,
    usesCustomTitle: usesCustomNativeTitle,
    backgroundColor,
    left: navigationLeftActions,
    right: rightActions ?? [],
  });

  if (shouldUseNativeHeader) {
    return null;
  }

  return (
    <View
      paddingTop={includeTopSafeArea ? top : 0}
      zIndex={50}
      backgroundColor={backgroundColor ?? '$background'}
      borderColor="$border"
      borderBottomWidth={borderBottom ? 1 : 0}
      testID={testID}
      onLayout={(event) => {
        const width = Math.round(event.nativeEvent.layout.width);
        setHeaderWidth((currentWidth) =>
          currentWidth === width ? currentWidth : width
        );
      }}
    >
      <View style={useHorizontalTitleLayout ? horizontalTitleStack : undefined}>
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
              {subtitleWithDisclosure}
            </View>
          </Animated.View>
        )}
        {interactiveTitleContent}
      </View>
      <HeaderControls
        side="left"
        onLayout={(event) => {
          const width = Math.round(event.nativeEvent.layout.width);
          setLeftControlsWidth((currentWidth) =>
            currentWidth === width ? currentWidth : width
          );
        }}
      >
        {backAction ? (
          <HeaderBackButton onPress={backAction} disabled={backDisabled} />
        ) : null}
        {leftControls}
        {leftActions ? (
          <ScreenHeaderItemElements actions={leftActions} />
        ) : null}
      </HeaderControls>
      <HeaderControls
        side="right"
        onLayout={(event) => {
          const width = Math.round(event.nativeEvent.layout.width);
          setRightControlsWidth((currentWidth) =>
            currentWidth === width ? currentWidth : width
          );
        }}
      >
        {rightControls}
        {rightActions ? (
          <ScreenHeaderItemElements actions={rightActions} />
        ) : null}
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

  const animatedClusterStyle = useAnimatedStyle(() => {
    const scale = clusterScale.value;
    const leftScaleCompensation = leftAlignWhileLoading
      ? -((1 - scale) * clusterWidth.value) / 2
      : 0;

    return {
      transform: [
        { translateX: leftScaleCompensation },
        { translateY: clusterTranslateY.value },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      onLayout={(event) => {
        clusterWidth.value = event.nativeEvent.layout.width;
      }}
      style={animatedClusterStyle}
    >
      {children}
    </Animated.View>
  );
}

function HeaderAnimatedTitle({
  title,
  isLoading,
  loadingText,
  leftAlignLoadingText = false,
  titleMaxWidth,
  loadingTextMaxWidth = 240,
  titleHeight,
}: {
  title: string;
  isLoading: boolean;
  loadingText: string;
  leftAlignLoadingText?: boolean;
  titleMaxWidth?: number | 'unset';
  loadingTextMaxWidth?: number;
  titleHeight?: number;
}) {
  const theme = useTheme();
  const loadingOpacity = useSharedValue(0);
  const loadingTranslateY = useSharedValue(6);
  const spinnerRotation = useSharedValue(0);
  const isAndroid = Platform.OS === 'android';
  const spinnerSize = isAndroid ? 10 : 8;
  const spinnerBorderWidth = 1;
  const spinnerGap = 6;
  const loadingAccessoryWidth = spinnerSize + spinnerGap;
  const loadingRowWidth =
    loadingTextMaxWidth +
    loadingAccessoryWidth * (leftAlignLoadingText ? 1 : 2);

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
      spinnerRotation.value = 0;
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
  }, [isLoading, loadingOpacity, loadingTranslateY, spinnerRotation]);

  const animatedLoadingStyle = useAnimatedStyle(() => {
    return {
      opacity: loadingOpacity.value,
      transform: [
        {
          translateX:
            !isAndroid && !leftAlignLoadingText && loadingRowWidth
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
  const spinnerStrokeStyle = {
    borderColor: spinnerColor,
    borderTopColor: 'transparent',
  };

  return (
    <View
      height={titleHeight ?? '$4xl'}
      alignItems="center"
      justifyContent="center"
      overflow="visible"
    >
      {isAndroid ? (
        // Android's native title host clips overflow to the measured child
        // width, so reserve the loading row's intrinsic width in layout.
        <View
          aria-hidden
          height={0}
          maxWidth={loadingRowWidth}
          flexDirection="row"
          opacity={0}
          overflow="hidden"
          pointerEvents="none"
        >
          <View width={spinnerSize} marginRight={spinnerGap} />
          <Text
            size="$label/s"
            trimmed={false}
            numberOfLines={1}
            maxWidth={loadingTextMaxWidth}
          >
            {loadingText}
          </Text>
          {!leftAlignLoadingText ? (
            <View width={loadingAccessoryWidth} />
          ) : null}
        </View>
      ) : null}
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
            left: isAndroid || leftAlignLoadingText ? 0 : '50%',
            right: isAndroid ? 0 : undefined,
            width: isAndroid ? undefined : loadingRowWidth,
            height: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: leftAlignLoadingText ? 'flex-start' : 'center',
          },
          animatedLoadingStyle,
        ]}
      >
        {isAndroid ? (
          <ActivityIndicator
            animating={isLoading}
            size={spinnerSize}
            color={spinnerColor}
            style={{
              width: spinnerSize,
              height: spinnerSize,
              marginRight: spinnerGap,
            }}
          />
        ) : (
          <Animated.View
            style={[
              {
                width: spinnerSize,
                height: spinnerSize,
                borderRadius: spinnerSize / 2,
                borderWidth: spinnerBorderWidth,
                marginRight: spinnerGap,
              },
              spinnerStrokeStyle,
              animatedSpinnerStyle,
            ]}
          />
        )}
        <Text
          size="$label/s"
          color="$secondaryText"
          trimmed={false}
          numberOfLines={1}
          maxWidth={loadingTextMaxWidth}
          testID="ScreenHeaderLoadingText"
        >
          {loadingText}
        </Text>
        {!leftAlignLoadingText ? (
          // Mirror the leading spinner and gap so the text itself, rather
          // than the spinner-and-text group, stays horizontally centered.
          <View width={loadingAccessoryWidth} />
        ) : null}
      </Animated.View>
    </View>
  );
}

export const ScreenHeader = withStaticProperties(ScreenHeaderComponent, {
  Controls: HeaderControls,
  Title: HeaderTitleText,
  BackButton: HeaderBackButton,
  IconButton: HeaderIconButton,
  TextButton: HeaderTextButton,
});
