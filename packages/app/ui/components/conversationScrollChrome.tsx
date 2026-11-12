import {
  HeaderHeightContext,
  getDefaultHeaderHeight,
} from '@react-navigation/elements';
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
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

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
  getPostCollectionTopInset,
  unobscuredConversationBottomGap,
} from './conversationInsets';

/**
 * Height the native header floats over, or 0 when it is opaque. A scroll view
 * gets this from contentInsetAdjustmentBehavior. Content rendered outside one,
 * such as a banner pinned above the list, has to clear it itself.
 *
 * Re-exported: the notes screens reach it from here, and the chat list uses
 * the same hook for its own header clearance from its navigation home.
 */
export { useFloatingHeaderHeight } from '../../navigation/useFloatingHeaderHeight';

// The last height a native header reported, for screens whose own header has
// not reported yet.
let lastReportedHeaderHeight = 0;

// How long a screen's header may take to report its real height. Past this, a
// header still at the navigator's guess is taken to be that height.
const HEADER_REPORT_WAIT_MS = 500;

/**
 * The header's height, or until this screen's header reports one, the height
 * the last one reported. A conversation used to open with no top inset and
 * gain it a moment later, and the list's correction for that, made while it
 * sat at its top where the offset cannot move, came back as a jump once
 * older posts arrived above.
 *
 * Until the native header reports, the navigator gives each screen its own
 * guess at the height, which on iOS 26 is 15 points short. Taking that guess
 * moved every conversation's top inset twice while it opened, each time
 * laying out and measuring its rows again before it could be shown.
 */
function useSettledHeaderHeight(topInset: number) {
  const reported = useContext(HeaderHeightContext) ?? 0;
  const frame = useSafeAreaFrame();
  const guess = getDefaultHeaderHeight(
    { width: frame.width, height: frame.height },
    false,
    topInset
  );
  const isGuess = reported > 0 && Math.abs(reported - guess) < 0.5;
  const [guessIsFinal, setGuessIsFinal] = useState(false);
  useEffect(() => {
    if (reported > 0 && !isGuess) {
      lastReportedHeaderHeight = reported;
    }
    if (!isGuess) {
      return;
    }
    const timeout = setTimeout(
      () => setGuessIsFinal(true),
      HEADER_REPORT_WAIT_MS
    );
    return () => clearTimeout(timeout);
  }, [isGuess, reported]);
  const settled =
    reported === 0 || (isGuess && !guessIsFinal)
      ? lastReportedHeaderHeight || reported || guess
      : reported;
  return { reported, settled };
}

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
  const { bottom: bottomSafeArea, top: topSafeArea } = useSafeAreaInsets();
  // Only the content inset uses the settled height. A screen that hides its
  // header (a bot conversation draws its own) reports 0 for good, and lays out
  // its other chrome from that.
  const { reported: navigationHeaderHeight, settled: headerHeight } =
    useSettledHeaderHeight(topSafeArea);
  const floatingHeaderHeight =
    hasTransparentHeader &&
    supportsNativeScrollEdgeChrome(
      Platform.OS,
      Platform.Version,
      supportsLiquidGlass()
    )
      ? headerHeight
      : 0;
  // getConversationContentInsets reduces this to `hasTransparentHeader ?
  // headerHeight : 0`, which is the floating height, so the two agree by
  // construction rather than by two copies of the same condition.
  const usesTransparentHeader = floatingHeaderHeight > 0;
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
    navigationHeaderHeight,
    floatingHeaderHeight,
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
      <FloatingActionButton
        icon={content}
        onPress={onPress}
        accessibilityLabel="Scroll to bottom"
        testID="ScrollToBottomButton"
      />
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
