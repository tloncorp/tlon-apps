import { NavigationContext } from '@react-navigation/native';
import type {
  NativeStackHeaderItem,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { useDebouncedValue } from '@tloncorp/shared';
import { Icon, Text, View } from '@tloncorp/ui';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Children,
  Fragment,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Platform, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  XStack,
  getVariableValue,
  useTheme,
  withStaticProperties,
} from 'tamagui';

import { getNativeHeaderOptions } from '../../navigation/nativeHeaderOptions';
import { useActiveTheme } from '../../provider';
import { getNativeColorScheme } from '../utils/themeUtils';
import { LongPressDisclosure } from './LongPressDisclosure';
import {
  NativeHeaderItemConfig,
  buildNativeHeaderItems,
  nativeIconSources,
  resolveNativeHeaderColor,
} from './nativeHeaderItems';
import {
  HeaderAnimatedCluster,
  HeaderAnimatedTitle,
} from './ScreenHeaderAnimation';
import {
  HeaderBackButton,
  HeaderControlProps,
  HeaderControls,
  HeaderIconButton,
  HeaderTextButton,
  HeaderTitleText,
} from './ScreenHeaderPrimitives';

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
  floating = false,
  useNativeHeader = true,
  scrollsUnderHeader = false,
}: PropsWithChildren<{
  title?: string | ReactNode;
  titleIcon?: ReactNode;
  subtitle?: string | ReactNode;
  showSubtitle?: boolean;
  backgroundColor?: string;
  leftControls?: ReactNode | null;
  rightControls?: ReactNode | null;
  backAction?: () => void;
  borderBottom?: boolean;
  onTitlePress?: () => void;
  useHorizontalTitleLayout?: boolean;
  loadingSubtitle?: string | null;
  testID?: string;
  floating?: boolean;
  useNativeHeader?: boolean;
  scrollsUnderHeader?: boolean;
}>) => {
  const { top } = useSafeAreaInsets();
  const theme = useTheme();
  const activeTheme = useActiveTheme();
  const navigation = useContext(NavigationContext);
  const [headerWidth, setHeaderWidth] = useState(0);
  const [leftControlsWidth, setLeftControlsWidth] = useState(0);
  const [rightControlsWidth, setRightControlsWidth] = useState(0);

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
    <XStack alignItems="center" justifyContent="center" gap="$s" height="$4xl">
      {titleIcon}
      {shouldUseAnimatedTitleLayout ? (
        <HeaderAnimatedTitle
          title={title}
          isLoading={isLoadingActive}
          loadingText={displayLoadingText}
          leftAlignLoadingText={useHorizontalTitleLayout}
          titleMaxWidth={titleMaxWidth}
          loadingTextMaxWidth={loadingTextMaxWidth}
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

  const childControls = getNativeChildControls(children);
  const nativeLeftControls = (
    <>
      {backAction ? <HeaderBackButton onPress={backAction} /> : null}
      {leftControls}
      {childControls.left}
    </>
  );
  const nativeRightControls = (
    <>
      {rightControls}
      {childControls.right}
    </>
  );
  const nativeLeftItems = getNativeHeaderItems(
    nativeLeftControls,
    'left',
    theme
  );
  const nativeRightItems = getNativeHeaderItems(
    nativeRightControls,
    'right',
    theme
  );
  const nativeTitleRef = useRef(interactiveTitleContent);
  const nativeLeftControlsRef = useRef(nativeLeftControls);
  const nativeRightControlsRef = useRef(nativeRightControls);
  const nativeLeftItemsRef = useRef(nativeLeftItems.items);
  const nativeRightItemsRef = useRef(nativeRightItems.items);

  nativeTitleRef.current = interactiveTitleContent;
  nativeLeftControlsRef.current = nativeLeftControls;
  nativeRightControlsRef.current = nativeRightControls;
  nativeLeftItemsRef.current = nativeLeftItems.items;
  nativeRightItemsRef.current = nativeRightItems.items;

  const shouldUseNativeHeader =
    Platform.OS !== 'web' && !floating && useNativeHeader && navigation != null;
  const usesCustomNativeTitle =
    typeof title !== 'string' ||
    titleIcon != null ||
    onTitlePress != null ||
    loadingSubtitle !== undefined;
  const nativeBackgroundColor = resolveNativeHeaderColor(
    backgroundColor,
    theme
  );
  const nativeTitleText = typeof title === 'string' ? title : '';
  const hasNativeLeftItems = nativeLeftItems.items.length > 0;
  const hasNativeRightItems = nativeRightItems.items.length > 0;
  const nativeHeaderSignature = [
    nativeTitleText,
    usesCustomNativeTitle ? 'custom' : 'system',
    loadingSubtitle ?? '',
    nativeLeftItems.signature,
    nativeRightItems.signature,
    nativeBackgroundColor,
    scrollsUnderHeader ? 'underlay' : 'contained',
  ].join('|');

  useLayoutEffect(() => {
    if (!shouldUseNativeHeader || !navigation) {
      return;
    }

    const baseOptions = getNativeHeaderOptions({
      title: nativeTitleText,
      isDarkMode: getNativeColorScheme(activeTheme) === 'dark',
      scrollsUnderHeader,
      backgroundColor: nativeBackgroundColor,
    });
    const options: NativeStackNavigationOptions = {
      ...baseOptions,
      headerBackVisible: false,
      headerTitle: usesCustomNativeTitle
        ? () => nativeTitleRef.current
        : undefined,
      headerLeft:
        Platform.OS === 'android' && hasNativeLeftItems
          ? () => (
              <NativeHeaderControls>
                {nativeLeftControlsRef.current}
              </NativeHeaderControls>
            )
          : undefined,
      headerRight:
        Platform.OS === 'android' && hasNativeRightItems
          ? () => (
              <NativeHeaderControls>
                {nativeRightControlsRef.current}
              </NativeHeaderControls>
            )
          : undefined,
      unstable_headerLeftItems:
        Platform.OS === 'ios' ? () => nativeLeftItemsRef.current : undefined,
      unstable_headerRightItems:
        Platform.OS === 'ios' ? () => nativeRightItemsRef.current : undefined,
    };

    navigation.setOptions(options);

    return () => {
      if (navigation.isFocused()) {
        navigation.setOptions({ headerShown: false });
      }
    };
  }, [
    activeTheme,
    hasNativeLeftItems,
    hasNativeRightItems,
    nativeBackgroundColor,
    nativeHeaderSignature,
    nativeTitleText,
    navigation,
    scrollsUnderHeader,
    shouldUseNativeHeader,
    usesCustomNativeTitle,
  ]);

  if (shouldUseNativeHeader) {
    return null;
  }

  return (
    <View
      paddingTop={top}
      zIndex={50}
      position={floating ? 'absolute' : undefined}
      top={floating ? 0 : undefined}
      left={floating ? 0 : undefined}
      right={floating ? 0 : undefined}
      elevationAndroid={floating && Platform.OS === 'android' ? 1 : undefined}
      backgroundColor={
        floating ? 'transparent' : backgroundColor ?? '$background'
      }
      borderColor="$border"
      borderBottomWidth={!floating && borderBottom ? 1 : 0}
      testID={testID}
      onLayout={(event) => {
        const width = Math.round(event.nativeEvent.layout.width);
        setHeaderWidth((currentWidth) =>
          currentWidth === width ? currentWidth : width
        );
      }}
    >
      {floating && Platform.OS !== 'ios' && (
        <LinearGradient
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { bottom: -32 }]}
          locations={[0, 0.66, 1]}
          colors={[
            getVariableValue(theme.background),
            getVariableValue(theme.background),
            'transparent',
          ]}
        />
      )}
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
        {backAction ? <HeaderBackButton onPress={backAction} /> : null}
        {leftControls}
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
      </HeaderControls>
      {children}
    </View>
  );
};

type ThemeValues = ReturnType<typeof useTheme>;

function NativeHeaderControls({ children }: PropsWithChildren) {
  return (
    <XStack height="$4xl" alignItems="center" gap="$l">
      {children}
    </XStack>
  );
}

function getNativeChildControls(children: ReactNode) {
  const left: ReactNode[] = [];
  const right: ReactNode[] = [];

  function append(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement<HeaderControlProps>(child)) {
        return;
      }

      if (child.type === Fragment) {
        append(child.props.children);
        return;
      }

      if (child.type === HeaderControls) {
        const destination = child.props.side === 'left' ? left : right;
        destination.push(child.props.children);
        return;
      }

      // Historically, free-form ScreenHeader children were positioned as
      // actions. Preserve them on the right when moving the owning screen into
      // a native navigation bar.
      right.push(child);
    });
  }

  append(children);

  return {
    left: left.length ? <>{left}</> : null,
    right: right.length ? <>{right}</> : null,
  };
}

function getNativeHeaderItems(
  controls: ReactNode,
  side: 'left' | 'right',
  theme: ThemeValues
): {
  items: NativeStackHeaderItem[];
  signature: string;
} {
  const configs: NativeHeaderItemConfig[] = [];

  function append(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement<HeaderControlProps>(child)) {
        return;
      }

      if (child.type === Fragment || child.type === HeaderControls) {
        append(child.props.children);
        return;
      }

      const id = child.props.testID ?? `screen-header-${side}-${configs.length}`;
      const accessibilityLabel =
        child.props.accessibilityLabel ?? child.props['aria-label'];
      const shared = {
        id,
        onPress: child.props.onPress,
        disabled: child.props.disabled || child.props.onPress == null,
        tint: child.props.color,
        testID: child.props.testID,
      };

      if (child.type === HeaderBackButton) {
        configs.push({
          ...shared,
          icon: 'ChevronLeft',
          label: accessibilityLabel ?? 'Back',
        });
        return;
      }

      if (child.type === HeaderTextButton) {
        configs.push({
          ...shared,
          text: getTextContent(child.props.children) || 'Action',
        });
        return;
      }

      if (
        child.type === HeaderIconButton &&
        child.props.type &&
        child.props.type in nativeIconSources
      ) {
        configs.push({
          ...shared,
          icon: child.props.type as keyof typeof nativeIconSources,
          label: accessibilityLabel ?? child.props.type,
        });
        return;
      }

      configs.push({ id, element: child as ReactElement });
    });
  }

  append(controls);

  return buildNativeHeaderItems(configs, theme);
}

function getTextContent(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === 'string' || typeof child === 'number'
        ? String(child)
        : ''
    )
    .join('');
}

export const ScreenHeader = withStaticProperties(ScreenHeaderComponent, {
  Controls: HeaderControls,
  Title: HeaderTitleText,
  BackButton: HeaderBackButton,
  IconButton: HeaderIconButton,
  TextButton: HeaderTextButton,
});
