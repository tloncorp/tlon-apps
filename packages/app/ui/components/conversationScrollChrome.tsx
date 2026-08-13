import { HeaderHeightContext } from '@react-navigation/elements';
import { FloatingActionButton, Icon, LoadingSpinner } from '@tloncorp/ui';
import {
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supportsNativeScrollEdgeChrome } from '../../navigation/nativeHeaderOptions';
import { GlassSurface, supportsLiquidGlass } from './GlassSurface';
import {
  floatingChromeMetrics,
  getConversationContentInsets,
} from './conversationInsets';

export {
  floatingChromeMetrics,
  floatingComposerEstimatedHeight,
  floatingPinnedPostBannerClearance,
  floatingPinnedPostBannerGap,
  floatingPinnedPostBannerHeight,
  floatingScrollControlClearance,
} from './conversationInsets';

/** Owns all measured geometry reserved around a conversation list. */
export function useConversationInsets({
  hasFloatingComposer,
  hasBottomSafeAreaClearance = false,
  hasTransparentHeader,
  hasFloatingPinnedPostBanner = false,
}: {
  hasFloatingComposer: boolean;
  hasBottomSafeAreaClearance?: boolean;
  hasTransparentHeader: boolean;
  hasFloatingPinnedPostBanner?: boolean;
}) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const { bottom: bottomSafeArea } = useSafeAreaInsets();
  const usesTransparentHeader =
    supportsNativeScrollEdgeChrome(
      Platform.OS,
      Platform.Version,
      supportsLiquidGlass()
    ) && hasTransparentHeader;
  const [measuredComposerHeight, setMeasuredComposerHeight] = useState<
    number | null
  >(null);
  const onFloatingHeightChange = useCallback((height: number) => {
    setMeasuredComposerHeight(height || null);
  }, []);
  const contentInsets = useMemo(
    () =>
      getConversationContentInsets({
        platform: Platform.OS,
        headerHeight,
        bottomSafeArea,
        measuredComposerHeight,
        hasFloatingComposer,
        hasBottomSafeAreaClearance,
        hasTransparentHeader: usesTransparentHeader,
        hasFloatingPinnedPostBanner,
      }),
    [
      bottomSafeArea,
      hasBottomSafeAreaClearance,
      hasFloatingComposer,
      hasFloatingPinnedPostBanner,
      headerHeight,
      measuredComposerHeight,
      usesTransparentHeader,
    ]
  );

  return {
    contentInsets,
    floatingHeaderHeight: usesTransparentHeader ? headerHeight : 0,
    onFloatingHeightChange:
      Platform.OS !== 'web' && hasFloatingComposer
        ? onFloatingHeightChange
        : undefined,
  };
}

const transitionDuration = 200;

export function ConversationScrollToBottomButton({
  inComposer = false,
  loading = false,
  onPress,
  visible,
}: {
  inComposer?: boolean;
  loading?: boolean;
  onPress: () => void;
  visible: boolean;
}) {
  const content = loading ? (
    <LoadingSpinner size="small" />
  ) : (
    <Icon type="ChevronDown" size="$m" />
  );

  if (!supportsLiquidGlass()) {
    return (
      <AnimatedScrollToBottomButton
        content={content}
        onPress={onPress}
        visible={visible}
      />
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <GlassSurface
      glassEffectStyle="regular"
      isInteractive
      style={[styles.control, inComposer ? styles.composerControl : undefined]}
    >
      {/* Liquid Glass does not render reliably beneath an opacity animation. */}
      <Pressable
        accessibilityLabel="Scroll to bottom"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onPress}
        style={styles.pressable}
        testID="ScrollToBottomButton"
      >
        {content}
      </Pressable>
    </GlassSurface>
  );
}

function AnimatedScrollToBottomButton({
  content,
  onPress,
  visible,
}: {
  content: ReactNode;
  onPress: () => void;
  visible: boolean;
}) {
  const animatedStyle = useScrollToBottomButtonTransition(visible);

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={animatedStyle}
    >
      <FloatingActionButton icon={content} onPress={onPress} />
    </Animated.View>
  );
}

function useScrollToBottomButtonTransition(visible: boolean) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: reduceMotion ? 0 : transitionDuration,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [progress, reduceMotion, visible]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 4 },
      { scale: 0.85 + progress.value * 0.15 },
    ],
  }));
}

const styles = StyleSheet.create({
  control: {
    width: floatingChromeMetrics.controlSize,
    height: floatingChromeMetrics.controlSize,
    borderRadius: floatingChromeMetrics.controlRadius,
    overflow: 'hidden',
  },
  composerControl: {
    position: 'absolute',
    top: floatingChromeMetrics.rowPaddingVertical,
    left: '50%',
    // The composer row's horizontal padding shifts this absolute coordinate
    // space left; compensate so the control is centered on the screen.
    marginLeft:
      -floatingChromeMetrics.controlSize / 2 +
      floatingChromeMetrics.rowPaddingHorizontal,
    zIndex: 1,
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
