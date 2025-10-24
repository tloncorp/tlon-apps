import { NavigationAction, useLinkProps } from '@react-navigation/native';
import { To } from '@react-navigation/native/lib/typescript/src/useLinkTo';
import { forwardRef, useContext } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { Stack, StackProps, isWeb } from 'tamagui';

import { ActionSheetContext } from '../contexts/ActionSheetContext';

type PressHandler = ((event: GestureResponderEvent) => void) | undefined | null;

type PressableProps = Omit<
  StackProps,
  'onPress' | 'onLongPress' | 'onPressIn' | 'onPressOut'
> & {
  onLongPress?: PressHandler;
  onPress?: PressHandler;
  onPressIn?: PressHandler;
  onPressOut?: PressHandler;
  onLayout?: (event: LayoutChangeEvent) => void;
  to?: To;
  action?: NavigationAction;
  children?: React.ReactNode;
};

const StackComponent = forwardRef<any, PressableProps>(
  (
    { onLongPress, onPress, onPressIn, onPressOut, children, ...stackProps },
    ref
  ) => {
    const isInsideSheet = useContext(ActionSheetContext).isInsideSheet;

    // On web, bypass all mobile-specific logic and act like a simple Stack
    if (isWeb) {
      return (
        <Stack
          ref={ref}
          // eslint-disable-next-line no-restricted-syntax
          onPress={onPress}
          cursor={stackProps.cursor || 'pointer'}
          {...stackProps}
        >
          {children}
        </Stack>
      );
    }

    // Mobile-only logic below
    const longPressHandler = onLongPress;

    // On Android inside ActionSheets, automatically use onPress for onPressOut
    // see:
    // - https://github.com/tamagui/tamagui/issues/3288
    // - https://github.com/react-navigation/react-navigation/issues/12039
    const shouldUseOnPressOut =
      Platform.OS === 'android' && isInsideSheet && onPress;

    return (
      <Stack
        ref={ref}
        pressStyle={{ opacity: 0.5 }}
        {...stackProps}
        // eslint-disable-next-line no-restricted-syntax
        onPress={shouldUseOnPressOut ? undefined : onPress}
        // eslint-disable-next-line no-restricted-syntax
        onPressIn={onPressIn}
        // eslint-disable-next-line no-restricted-syntax
        onPressOut={shouldUseOnPressOut ? onPress : onPressOut}
        // eslint-disable-next-line no-restricted-syntax
        onLongPress={longPressHandler}
      >
        {children}
      </Stack>
    );
  }
);

StackComponent.displayName = 'StackComponent';

/**
 * Component that wraps content and makes it pressable.
 * It provides the same props as `Stack` component.
 * It also accepts `to` and `action` props to use with `useLinkProps`.
 * If `action` is provided, `to` must be specified.
 * More info at https://reactnavigation.org/docs/use-link-props
 *
 * @param props.onPress Function to call when the press is released.
 * @param props.onPressIn Function to call when the press starts.
 * @param props.onPressOut Function to call when the touch moves outside the element bounds.
 * @param props.onLongPress Function to call when the press is held. Disabled on web.
 * @param props.to Absolute path to screen (e.g. `/feeds/hot`).
 * @param props.action Optional action to use for in-page navigation. By default, the path is parsed to an action based on linking config.
 */

const Pressable = forwardRef<any, PressableProps>(
  (
    {
      onPress,
      onPressIn,
      onPressOut,
      onLongPress,
      to,
      action,
      children,
      ...stackProps
    },
    ref
  ) => {
    const longPressHandler = isWeb ? undefined : onLongPress;
    const { onPress: onPressLink, ...linkProps } = useLinkProps({
      to: to ?? '',
      action,
    });

    // Check for interaction handlers - only needed on mobile for touch bubbling
    // On web, we skip this check as it interferes with styled() components
    const hasInteractionHandler = isWeb
      ? true // Always consider web components interactive
      : (action == null ? onPress : onPressLink) ||
        onPressIn ||
        onPressOut ||
        onLongPress;

    if (action && !to) {
      throw new Error(
        'The `to` prop is required when `action` is specified in `Pressable`'
      );
    }

    if (to || action) {
      return (
        <StackComponent
          ref={ref}
          {...stackProps}
          {...linkProps}
          group
          onPress={onPressLink ?? onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={longPressHandler}
          cursor={stackProps.cursor || 'pointer'}
          // Pressable always blocks touches from bubbling to ancestors, even if
          // no handlers are attached.
          // To allow bubbling, disable the Pressable (mixin) when no handlers
          // are attached.
          disabled={!hasInteractionHandler}
        >
          {children}
        </StackComponent>
      );
    }

    return (
      <StackComponent
        ref={ref}
        {...stackProps}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onLongPress={longPressHandler}
        disabled={!hasInteractionHandler}
        cursor={stackProps.cursor || 'pointer'}
      >
        {children}
      </StackComponent>
    );
  }
);

Pressable.displayName = 'Pressable';

export default Pressable;
