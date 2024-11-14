import { NavigationAction, useLinkProps } from '@react-navigation/native';
import { To } from '@react-navigation/native/lib/typescript/src/useLinkTo';
import { GestureResponderEvent } from 'react-native';
import { Stack, StackProps, isWeb } from 'tamagui';

type PressHandler = ((event: GestureResponderEvent) => void) | undefined | null;

type PressableProps = Omit<StackProps, 'onPress' | 'onLongPress'> & {
  onLongPress?: PressHandler;
  onPress?: PressHandler;
  to?: To;
  action?: NavigationAction;
  children: React.ReactNode;
};

const StackComponent = ({
  onLongPress,
  onPress,
  children,
  ...stackProps
}: PressableProps) => {
  const longPressHandler = isWeb ? undefined : onLongPress;

  return (
    <Stack
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      {...stackProps}
      // eslint-disable-next-line no-restricted-syntax
      onPress={onPress}
      // eslint-disable-next-line no-restricted-syntax
      onLongPress={longPressHandler}
    >
      {children}
    </Stack>
  );
};

/**
 * Component that wraps content and makes it pressable.
 * It provides the same props as `Stack` component.
 * It also accepts `to` and `action` props to use with `useLinkProps`.
 * If `action` is provided, `to` must be specified.
 * More info at https://reactnavigation.org/docs/use-link-props
 *
 * @param props.onPress Function to call when the press is released.
 * @param props.onLongPress Function to call when the press is held. Disabled on web.
 * @param props.to Absolute path to screen (e.g. `/feeds/hot`).
 * @param props.action Optional action to use for in-page navigation. By default, the path is parsed to an action based on linking config.
 */

export default function Pressable({
  onPress,
  onLongPress,
  to,
  action,
  children,
  ...stackProps
}: PressableProps) {
  const longPressHandler = isWeb ? undefined : onLongPress;
  const { onPress: onPressLink, ...linkProps } = useLinkProps({
    to: to ?? '',
    action,
  });

  if (action && !to) {
    throw new Error(
      'The `to` prop is required when `action` is specified in `Pressable`'
    );
  }

  if (to || action) {
    return (
      <StackComponent
        {...stackProps}
        {...linkProps}
        group
        onPress={onPressLink ?? onPress}
        onLongPress={longPressHandler}
      >
        {children}
      </StackComponent>
    );
  }

  return (
    <StackComponent
      {...stackProps}
      onPress={onPress}
      onLongPress={longPressHandler}
    >
      {children}
    </StackComponent>
  );
}
