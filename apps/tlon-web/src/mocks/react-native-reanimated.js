/**
 * Web shim for react-native-reanimated.
 *
 * Replaces the 472KB reanimated library with lightweight CSS-transition-based
 * animations. Shared values are backed by React refs + forceUpdate so that
 * useAnimatedStyle picks up changes on re-render.
 */

import { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';

// ---------------------------------------------------------------------------
// Shared values
// ---------------------------------------------------------------------------

export function useSharedValue(initial) {
  const [, forceRender] = useState(0);
  const ref = useRef(initial);
  const sv = useMemo(() => {
    const obj = {
      get value() {
        return ref.current;
      },
      set value(v) {
        ref.current = v;
        forceRender((c) => c + 1);
      },
    };
    return obj;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return sv;
}

// ---------------------------------------------------------------------------
// Animated styles
// ---------------------------------------------------------------------------

export function useAnimatedStyle(fn) {
  return fn();
}

export function useDerivedValue(fn) {
  const sv = useSharedValue(fn());
  return sv;
}

export function useAnimatedProps(fn) {
  return fn();
}

export function useAnimatedReaction(_prepare, _react, _deps) {
  // no-op on web — reactions are for worklet thread coordination
}

// ---------------------------------------------------------------------------
// Animation modifiers – on web these just set the target value.
// CSS transitions on Animated.View handle the visual interpolation.
// ---------------------------------------------------------------------------

export function withTiming(toValue, config, callback) {
  if (callback) {
    const duration = config?.duration ?? 300;
    setTimeout(() => callback(true), duration);
  }
  return toValue;
}

export function withSpring(toValue, _config, callback) {
  if (callback) {
    setTimeout(() => callback(true), 500);
  }
  return toValue;
}

export function withDelay(_delay, animation) {
  // The animation value is already resolved; CSS transition-delay or
  // setTimeout in the caller handles the actual delay.
  return animation;
}

export function withRepeat(animation, _numberOfReps, _reverse, callback) {
  if (callback) setTimeout(() => callback(true), 0);
  return animation;
}

export function withDecay(_config, callback) {
  if (callback) setTimeout(() => callback(true), 300);
  return 0;
}

export function withSequence(...animations) {
  // Return the last animation value (they resolve to target values in our shim)
  return animations[animations.length - 1];
}

export function cancelAnimation(_sharedValue) {
  // no-op – CSS animations cancel on style change
}

export function makeMutable(initial) {
  return { value: initial };
}

export const Extrapolation = {
  EXTEND: 'extend',
  CLAMP: 'clamp',
  IDENTITY: 'identity',
};

export const ReduceMotion = {
  System: 'system',
  Always: 'always',
  Never: 'never',
};

export function useReducedMotion() {
  return false;
}

export function useAnimatedRef() {
  return useRef(null);
}

export function scrollTo(_ref, _x, _y, _animated) {
  // no-op on web — use element.scrollTo directly
}

export function useAnimatedGestureHandler(handlers) {
  return handlers;
}

export function isConfigured() {
  return true;
}

// ---------------------------------------------------------------------------
// worklet helpers
// ---------------------------------------------------------------------------

export function runOnJS(fn) {
  return fn;
}

export function runOnUI(fn) {
  return fn;
}

// ---------------------------------------------------------------------------
// Easing (maps to CSS cubic-bezier values)
// ---------------------------------------------------------------------------

export const Easing = {
  linear: { factory: () => {} },
  ease: { factory: () => {} },
  in: (_easing) => ({ factory: () => {} }),
  out: (_easing) => ({ factory: () => {} }),
  inOut: (_easing) => ({ factory: () => {} }),
  cubic: { factory: () => {} },
  bezier: () => ({ factory: () => {} }),
  bezierFn: () => (t) => t,
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function clamp(value, min, max) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function interpolate(value, inputRange, outputRange) {
  'worklet';
  // Linear interpolation between ranges
  const i = inputRange.findIndex((_v, idx) => idx < inputRange.length - 1 && value <= inputRange[idx + 1]);
  const idx = Math.max(0, i);
  const inputMin = inputRange[idx];
  const inputMax = inputRange[idx + 1] ?? inputRange[idx];
  const outputMin = outputRange[idx];
  const outputMax = outputRange[idx + 1] ?? outputRange[idx];
  if (inputMax === inputMin) return outputMin;
  const t = (value - inputMin) / (inputMax - inputMin);
  return outputMin + t * (outputMax - outputMin);
}

export function interpolateColor(value, inputRange, outputRange) {
  'worklet';
  // Simple: return the closest color in the output range
  const idx = inputRange.findIndex((_v, i) => i < inputRange.length - 1 && value <= inputRange[i + 1]);
  return outputRange[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// Entering / Exiting animations
// ---------------------------------------------------------------------------

class LayoutAnimation {
  duration(_ms) { return this; }
  delay(_ms) { return this; }
  easing(_e) { return this; }
  springify() { return this; }
  damping(_d) { return this; }
  stiffness(_s) { return this; }
  build() { return undefined; }
}

export class FadeIn extends LayoutAnimation {
  static duration(_ms) { return new FadeIn(); }
  static delay(_ms) { return new FadeIn(); }
  static createInstance() { return new FadeIn(); }
}

export class FadeOut extends LayoutAnimation {
  static duration(_ms) { return new FadeOut(); }
  static delay(_ms) { return new FadeOut(); }
  static createInstance() { return new FadeOut(); }
}

export class SlideInRight extends LayoutAnimation {
  static createInstance() { return new SlideInRight(); }
}
export class SlideOutRight extends LayoutAnimation {
  static createInstance() { return new SlideOutRight(); }
}

// ---------------------------------------------------------------------------
// Scroll handler
// ---------------------------------------------------------------------------

export function useAnimatedScrollHandler(handler) {
  return useCallback(
    (event) => {
      const nativeEvent = event?.nativeEvent ?? event;
      if (typeof handler === 'function') {
        handler(nativeEvent);
      } else if (handler?.onScroll) {
        handler.onScroll(nativeEvent);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}

// ---------------------------------------------------------------------------
// Animated components
// ---------------------------------------------------------------------------

const AnimatedView = forwardRef((props, ref) => {
  const { style, entering, exiting, ...rest } = props;
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
  return <View ref={ref} style={{ transition: 'all 300ms ease', ...flatStyle }} {...rest} />;
});
AnimatedView.displayName = 'Animated.View';

const AnimatedFlatList = forwardRef((props, ref) => {
  return <FlatList ref={ref} {...props} />;
});
AnimatedFlatList.displayName = 'Animated.FlatList';

function createAnimatedComponent(Component) {
  const Wrapper = forwardRef((props, ref) => {
    const { style, entering, exiting, ...rest } = props;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    return <Component ref={ref} style={{ transition: 'all 300ms ease', ...flatStyle }} {...rest} />;
  });
  Wrapper.displayName = `Animated(${Component.displayName || Component.name || 'Component'})`;
  return Wrapper;
}

const Animated = {
  View: AnimatedView,
  FlatList: AnimatedFlatList,
  createAnimatedComponent,
  ScrollView: createAnimatedComponent(View),
  addWhitelistedNativeProps: () => {},
  addWhitelistedUIProps: () => {},
};

export default Animated;

// Type/class placeholders used by moti and other libraries
export class BaseAnimationBuilder {
  static duration() { return new BaseAnimationBuilder(); }
  static delay() { return new BaseAnimationBuilder(); }
  build() { return undefined; }
}

export const EntryExitAnimationFunction = undefined;
export const LayoutAnimationFunction = undefined;
export const SharedValue = undefined;
export const DerivedValue = undefined;
