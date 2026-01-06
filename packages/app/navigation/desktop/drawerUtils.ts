import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { isEqual } from 'lodash';

/**
 * Custom memo comparison for DrawerContent components.
 * Only checks navigation state changes we care about, ignoring unstable
 * callback references in DrawerContentComponentProps.
 */
export function compareDrawerContentProps(
  prevProps: DrawerContentComponentProps,
  nextProps: DrawerContentComponentProps
): boolean {
  const prevState = prevProps.state;
  const nextState = nextProps.state;

  // Re-render if route index changed
  if (prevState.index !== nextState.index) {
    return false;
  }

  const prevRoute = prevState.routes[prevState.index];
  const nextRoute = nextState.routes[nextState.index];

  // Re-render if route key changed
  if (prevRoute.key !== nextRoute.key) {
    return false;
  }

  // Only deep compare params (much smaller than full props)
  return isEqual(prevRoute.params, nextRoute.params);
}
