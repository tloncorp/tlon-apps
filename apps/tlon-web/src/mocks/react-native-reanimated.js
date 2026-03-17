/**
 * Web shim for react-native-reanimated.
 *
 * Replaces the 472KB reanimated library with requestAnimationFrame-based
 * animations. Shared values trigger React re-renders when updated, and
 * withTiming/withSpring interpolate over time using rAF.
 */

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

// ---------------------------------------------------------------------------
// Animation engine
// ---------------------------------------------------------------------------

const ANIMATION_TAG = '__reanimatedShimAnim';

function isAnimationConfig(v) {
  return v != null && typeof v === 'object' && v[ANIMATION_TAG] === true;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Run an animation, calling `onFrame` each rAF tick and `onDone` at the end. */
function runAnimation(config, fromValue, onFrame, onDone) {
  if (config.type === 'delay') {
    const timerId = setTimeout(() => {
      runAnimation(config.inner, fromValue, onFrame, onDone);
    }, config.delay);
    return () => clearTimeout(timerId);
  }

  if (config.type === 'sequence') {
    let cancel = null;
    let idx = 0;
    function next(currentValue) {
      if (idx >= config.animations.length) {
        if (onDone) onDone(true);
        return;
      }
      const anim = config.animations[idx++];
      if (isAnimationConfig(anim)) {
        cancel = runAnimation(anim, currentValue, onFrame, (finished) => {
          next(anim.toValue ?? currentValue);
        });
      } else {
        // Raw value
        onFrame(anim);
        next(anim);
      }
    }
    next(fromValue);
    return () => { if (cancel) cancel(); };
  }

  if (config.type === 'repeat') {
    let cancel = null;
    let reps = 0;
    const maxReps = config.numberOfReps < 0 ? Infinity : config.numberOfReps;
    let currentValue = fromValue;
    function loop() {
      if (reps >= maxReps) {
        if (onDone) onDone(true);
        return;
      }
      reps++;
      const target = config.reverse && reps % 2 === 0 ? fromValue : config.inner.toValue ?? fromValue;
      cancel = runAnimation(
        { ...config.inner, toValue: target },
        currentValue,
        onFrame,
        () => { currentValue = target; loop(); }
      );
    }
    loop();
    return () => { if (cancel) cancel(); };
  }

  // Timing animation
  const duration = config.duration ?? 300;
  const toValue = config.toValue ?? 0;
  const startTime = performance.now();
  const startValue = typeof fromValue === 'number' ? fromValue : 0;
  let rafId = null;

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / Math.max(duration, 1), 1);
    const easedProgress = config.type === 'spring' ? easeInOutCubic(progress) : easeInOutCubic(progress);
    const currentValue = startValue + (toValue - startValue) * easedProgress;
    onFrame(currentValue);

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      if (config.callback) config.callback(true);
      if (onDone) onDone(true);
    }
  }

  rafId = requestAnimationFrame(step);
  return () => { if (rafId) cancelAnimationFrame(rafId); };
}

// ---------------------------------------------------------------------------
// Shared values
// ---------------------------------------------------------------------------

export function useSharedValue(initial) {
  const [, forceRender] = useState(0);
  const ref = useRef(initial);
  const cancelRef = useRef(null);

  const sv = useMemo(() => {
    const obj = {
      get value() {
        return ref.current;
      },
      set value(v) {
        // Cancel any running animation
        if (cancelRef.current) {
          cancelRef.current();
          cancelRef.current = null;
        }

        if (isAnimationConfig(v)) {
          // Start animated transition
          cancelRef.current = runAnimation(
            v,
            ref.current,
            (frameValue) => {
              ref.current = frameValue;
              forceRender((c) => c + 1);
            },
            () => { cancelRef.current = null; }
          );
        } else {
          // Immediate set
          ref.current = v;
          forceRender((c) => c + 1);
        }
      },
      modify(fn) {
        const newVal = fn(ref.current);
        if (isAnimationConfig(newVal)) {
          obj.value = newVal;
        } else {
          ref.current = newVal;
          forceRender((c) => c + 1);
        }
      },
    };
    return obj;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cancelRef.current) cancelRef.current();
    };
  }, []);

  return sv;
}

// ---------------------------------------------------------------------------
// Animated styles
// ---------------------------------------------------------------------------

export function useAnimatedStyle(fn) {
  return StyleSheet.flatten(fn());
}

export function useDerivedValue(fn) {
  const sv = useSharedValue(fn());
  return sv;
}

export function useAnimatedProps(fn) {
  return fn();
}

export function useAnimatedReaction(_prepare, _react, _deps) {
  // no-op on web
}

// ---------------------------------------------------------------------------
// Animation modifiers — return config objects that useSharedValue interprets
// ---------------------------------------------------------------------------

export function withTiming(toValue, config, callback) {
  return {
    [ANIMATION_TAG]: true,
    type: 'timing',
    toValue,
    duration: config?.duration ?? 300,
    callback,
  };
}

export function withSpring(toValue, config, callback) {
  return {
    [ANIMATION_TAG]: true,
    type: 'spring',
    toValue,
    duration: config?.duration ?? 500,
    callback,
  };
}

export function withDelay(delay, animation) {
  if (isAnimationConfig(animation)) {
    return {
      [ANIMATION_TAG]: true,
      type: 'delay',
      delay,
      inner: animation,
    };
  }
  // If animation is a raw value, just return it after delay
  return {
    [ANIMATION_TAG]: true,
    type: 'delay',
    delay,
    inner: { [ANIMATION_TAG]: true, type: 'timing', toValue: animation, duration: 0 },
  };
}

export function withRepeat(animation, numberOfReps = 2, reverse = false, callback) {
  return {
    [ANIMATION_TAG]: true,
    type: 'repeat',
    inner: isAnimationConfig(animation) ? animation : { [ANIMATION_TAG]: true, type: 'timing', toValue: animation, duration: 0 },
    numberOfReps,
    reverse,
    callback,
  };
}

export function withDecay(_config, callback) {
  return {
    [ANIMATION_TAG]: true,
    type: 'timing',
    toValue: 0,
    duration: 300,
    callback,
  };
}

export function withSequence(...animations) {
  return {
    [ANIMATION_TAG]: true,
    type: 'sequence',
    animations,
  };
}

export function cancelAnimation(sharedValue) {
  // Force-set current value to cancel
  if (sharedValue && typeof sharedValue.value === 'number') {
    sharedValue.value = sharedValue.value;
  }
}

export function makeMutable(initial) {
  const obj = { value: initial };
  obj.modify = (fn) => { obj.value = fn(obj.value); };
  return obj;
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
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRef(null);
}

export function scrollTo(_ref, _x, _y, _animated) {
  // no-op
}

export function useAnimatedGestureHandler(handlers) {
  return handlers;
}

export function isConfigured() {
  return true;
}

// ---------------------------------------------------------------------------
// Worklet helpers
// ---------------------------------------------------------------------------

export function runOnJS(fn) {
  return fn;
}

export function runOnUI(fn) {
  return fn;
}

// ---------------------------------------------------------------------------
// Easing
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
  // eslint-disable-next-line no-unused-vars
  const { style, entering, exiting, ...rest } = props;
  return <View ref={ref} style={StyleSheet.flatten(style)} {...rest} />;
});
AnimatedView.displayName = 'Animated.View';

const AnimatedFlatList = forwardRef((props, ref) => {
  return <FlatList ref={ref} {...props} />;
});
AnimatedFlatList.displayName = 'Animated.FlatList';

function createAnimatedComponent(Component) {
  const Wrapper = forwardRef((props, ref) => {
    // eslint-disable-next-line no-unused-vars
    const { style, entering, exiting, ...rest } = props;
    return <Component ref={ref} style={StyleSheet.flatten(style)} {...rest} />;
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
