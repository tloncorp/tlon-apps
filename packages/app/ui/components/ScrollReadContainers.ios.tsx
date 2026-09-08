import { requireNativeViewManager } from 'expo-modules-core';
import { forwardRef } from 'react';
import * as ReactNative from 'react-native';
import type { View, ViewProps, GestureResponderEvent } from 'react-native';
import { unstable_hasExternalPressOwnership } from '@tamagui/native';

import type { NativeReadContainerProps } from './ScrollReadContainers.types';

const Scope = requireNativeViewManager<NativeReadContainerProps>(
  'TlonScrollEdgeEffect',
  'ScrollReadScopeContainer'
);
const Item = requireNativeViewManager<NativeReadContainerProps>(
  'TlonScrollEdgeEffect',
  'ScrollReadItemContainer'
);

export const NativeReadScopeContainer = forwardRef<
  View,
  NativeReadContainerProps
>(function NativeReadScopeContainer(props, ref) {
  return <Scope {...props} ref={ref} />;
});
// RN exports this hook at runtime and in its generated API, but its legacy
// declaration entry omits it. Keep this local type bridge at the native boundary.
type PressConfig = Pick<
  NativeReadContainerProps,
  | 'onPress'
  | 'onPressIn'
  | 'onPressOut'
  | 'onLongPress'
  | 'disabled'
  | 'delayLongPress'
  | 'delayPressIn'
  | 'delayPressOut'
  | 'hitSlop'
  | 'onFocus'
  | 'onBlur'
>;
const usePressability = (
  ReactNative as typeof ReactNative & {
    usePressability: (config: PressConfig | null) => ViewProps | null;
  }
).usePressability;

export const NativeReadItemContainer = forwardRef<
  View,
  NativeReadContainerProps
>(function NativeReadItemContainer(props, ref) {
  const {
    onPress,
    onPressIn,
    onPressOut,
    onLongPress,
    disabled,
    delayLongPress,
    delayPressIn,
    delayPressOut,
    ...viewProps
  } = props;
  const interactive = Boolean(
    onPress || onPressIn || onPressOut || onLongPress
  );
  const guard = (callback: typeof onPress) =>
    callback
      ? (event: GestureResponderEvent) => {
          if (!disabled && !unstable_hasExternalPressOwnership())
            callback(event);
        }
      : undefined;
  // A custom Tamagui base receives press callbacks instead of Tamagui's own
  // responder. RN owns this responder and its cancellation/unmount timers;
  // the carrier remains the single physical view.
  const handlers = usePressability({
    disabled: disabled || !interactive,
    hitSlop: props.hitSlop,
    delayLongPress,
    delayPressIn,
    delayPressOut,
    onPress: guard(onPress),
    onPressIn: guard(onPressIn),
    onLongPress: guard(onLongPress),
    onPressOut,
    onFocus: props.onFocus,
    onBlur: props.onBlur,
  });
  if (!interactive) return <Item {...viewProps} ref={ref} />;
  const events = { ...handlers };
  if (interactive || handlers) {
    events.onStartShouldSetResponder = (event) =>
      !unstable_hasExternalPressOwnership() &&
      !disabled &&
      interactive &&
      (viewProps.onStartShouldSetResponder?.(event) ||
        handlers?.onStartShouldSetResponder?.(event) ||
        false);
    for (const name of [
      'onResponderGrant',
      'onResponderMove',
      'onResponderRelease',
      'onResponderTerminate',
    ] as const) {
      const handler = handlers?.[name];
      const supplied = viewProps[name];
      events[name] = (event) => {
        if (name === 'onResponderGrant' && unstable_hasExternalPressOwnership())
          return;
        supplied?.(event);
        handler?.(event);
      };
    }
    events.onResponderTerminationRequest = (event) =>
      viewProps.onResponderTerminationRequest?.(event) ??
      handlers?.onResponderTerminationRequest?.(event) ??
      true;
  }
  return <Item {...viewProps} {...events} ref={ref} />;
});
