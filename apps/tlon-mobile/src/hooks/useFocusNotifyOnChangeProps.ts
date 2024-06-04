import { useFocusEffect } from '@react-navigation/native';
import { NotifyOnChangeProps } from '@tanstack/query-core';
import React from 'react';

/**
 * Wires `react-query` up to `react-navigation` to prevent offscreen components
 * from re-rendering unnecessarily.
 *
 * To use, use the function returned by this hook as the `notifyOnChangeProps` param
 * of a react-query query.
 *
 * `notifyOnChangeProps` controls which properties of the react-query query
 * object will trigger re-renders when modified. This function disables all
 * properties when the view is not focused, preventing re-render of offscreen
 * content.
 *
 * Not that this doesn't prevent the query/db work from happening, which we may
 * want at some point.
 *
 * Based on
 * https://tanstack.com/query/latest/docs/framework/react/react-native#disable-re-renders-on-out-of-focus-screens
 */
export function useFocusNotifyOnChangeProps(
  notifyOnChangeProps?: NotifyOnChangeProps
): NotifyOnChangeProps {
  const focusedRef = React.useRef(true);

  useFocusEffect(
    React.useCallback(() => {
      focusedRef.current = true;

      return () => {
        focusedRef.current = false;
      };
    }, [])
  );

  // @ts-expect-error NotifyOnChangeProps type is incorrect in react query, see
  // https://github.com/TanStack/query/issues/7426
  return () => {
    // If the screen is blurred, no properties should trigger a rerender on
    // change.
    if (!focusedRef.current) {
      return [];
    }

    // If this screen is focused, and changeProps are defined with a function, execute
    // it to get the final props
    if (typeof notifyOnChangeProps === 'function') {
      return notifyOnChangeProps();
    }

    // Otherwise just return whatever the default we passed in way. If it's
    // undefined, react-query will default to using its tracking of property
    // accesses to determine when to rerender.
    return notifyOnChangeProps;
  };
}
