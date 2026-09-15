import { forwardRef, useMemo } from 'react';
import { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { View, ViewProps, isWeb } from 'tamagui';

type PressHandler = ((event: GestureResponderEvent) => void) | undefined | null;

type PressableProps = Omit<
  ViewProps,
  'onPress' | 'onLongPress' | 'onPressIn' | 'onPressOut'
> & {
  onLongPress?: PressHandler;
  onPress?: PressHandler;
  onPressIn?: PressHandler;
  onPressOut?: PressHandler;
  onLayout?: (event: LayoutChangeEvent) => void;
  children?: React.ReactNode;
};

const StackComponent = forwardRef<any, PressableProps>(
  (
    { onLongPress, onPress, onPressIn, onPressOut, children, ...stackProps },
    ref
  ) => {
    // On web, bypass all mobile-specific logic and act like a simple Stack
    if (isWeb) {
      return (
        <View
          ref={ref}
          // eslint-disable-next-line tlon/no-stack-press
          onPress={onPress}
          cursor={stackProps.cursor || 'pointer'}
          {...stackProps}
        >
          {children}
        </View>
      );
    }

    // Mobile-only logic below
    const longPressHandler = onLongPress;

    return (
      <View
        ref={ref}
        pressStyle={{ opacity: 0.5 }}
        {...stackProps}
        // eslint-disable-next-line tlon/no-stack-press
        onPress={onPress}
        // eslint-disable-next-line tlon/no-stack-press
        onPressIn={onPressIn}
        // eslint-disable-next-line tlon/no-stack-press
        onPressOut={onPressOut}
        // eslint-disable-next-line tlon/no-stack-press
        onLongPress={longPressHandler}
      >
        {children}
      </View>
    );
  }
);

StackComponent.displayName = 'StackComponent';

/**
 * Component that wraps content and makes it pressable.
 * It provides the same props as `Stack` component.
 *
 * This component deliberately has no link support: it must be able to render
 * outside a `NavigationContainer` (e.g. inside a `@gorhom/portal` host), where
 * calling a navigation hook throws. If link-style pressables are ever needed,
 * they belong in a separate component that calls `useLinkProps`.
 *
 * @param props.onPress Function to call when the press is released.
 * @param props.onPressIn Function to call when the press starts.
 * @param props.onPressOut Function to call when the touch moves outside the element bounds.
 * @param props.onLongPress Function to call when the press is held. Disabled on web.
 */

const Pressable = forwardRef<any, PressableProps>(
  (
    {
      onPress,
      onPressIn,
      onPressOut,
      onLongPress,
      children,
      style: propStyle,
      disabled: propDisabled,
      disabledStyle,
      ...stackProps
    },
    ref
  ) => {
    const longPressHandler = isWeb ? undefined : onLongPress;

    // Check for interaction handlers - only needed on mobile for touch bubbling
    // On web, we skip this check as it interferes with styled() components
    const hasInteractionHandler = isWeb
      ? true // Always consider web components interactive
      : onPress || onPressIn || onPressOut || onLongPress;

    // Pressable always blocks touches from bubbling to ancestors, even if
    // no handlers are attached.
    // To allow bubbling, disable the Pressable (mixin) when no handlers
    // are attached.
    const disabled = propDisabled || !hasInteractionHandler;

    const style = useMemo<ViewProps['style']>(
      () => [
        propStyle,
        // @ts-expect-error - we're trying to fit the Pressable
        // `disabledStyle` into a Stack style
        disabled && disabledStyle,
      ],
      [propStyle, disabledStyle, disabled]
    );

    return (
      <StackComponent
        ref={ref}
        {...stackProps}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onLongPress={longPressHandler}
        cursor={stackProps.cursor || 'pointer'}
        disabled={disabled}
        style={style}
      >
        {children}
      </StackComponent>
    );
  }
);

Pressable.displayName = 'Pressable';

export default Pressable;
