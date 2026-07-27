import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { ScrollToBottomButtonChromeProps } from './ScrollToBottomButtonChrome.types';
import {
  scrollToBottomButtonTransitionDuration,
  useScrollToBottomButtonTransition,
} from './useScrollToBottomButtonTransition';

function canUseLiquidGlass() {
  return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
}

export function ScrollToBottomButtonChrome({
  children,
  onPress,
  visible,
}: ScrollToBottomButtonChromeProps) {
  const { animatedStyle, reduceMotion } =
    useScrollToBottomButtonTransition(visible);
  const control = (
    <Animated.View style={[styles.content, animatedStyle]}>
      <Pressable
        accessibilityLabel="Scroll to bottom"
        accessibilityRole="button"
        disabled={!visible}
        hitSlop={8}
        onPress={onPress}
        style={styles.pressable}
        testID="ScrollToBottomButton"
      >
        {children}
      </Pressable>
    </Animated.View>
  );

  if (canUseLiquidGlass()) {
    return (
      <GlassView
        accessibilityElementsHidden={!visible}
        glassEffectStyle={{
          style: visible ? 'regular' : 'none',
          animate: !reduceMotion,
          animationDuration: scrollToBottomButtonTransitionDuration / 1000,
        }}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
        isInteractive={visible}
        pointerEvents={visible ? 'auto' : 'none'}
        style={styles.control}
      >
        {control}
      </GlassView>
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <BlurView intensity={90} tint="systemMaterial" style={styles.control}>
      {control}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  control: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
