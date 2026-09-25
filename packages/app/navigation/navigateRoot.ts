import {
  CommonActions,
  NavigationContainerRefContext,
} from '@react-navigation/native';
import { createDevLogger } from '@tloncorp/shared';
import { type ContextType, useCallback, useContext, useMemo } from 'react';

const logger = createDevLogger('navigateRoot', false);

export type ContainerRef = NonNullable<
  ContextType<typeof NavigationContainerRefContext>
>;

/**
 * Navigates the root navigator itself. A navigate dispatched from the
 * container is offered to the deepest focused navigator first, and the split
 * tree's inner stacks have routes named like the drawer's (`Home`).
 *
 * Returns false without navigating while no root navigator is mounted, such
 * as during a swap between the phone and split trees.
 */
export function navigateRoot(
  container: ContainerRef | undefined,
  route: { name: string; params?: object }
): boolean {
  const rootKey = container?.getRootState()?.key;
  if (!container || !rootKey) {
    logger.trackError('Root navigator not mounted', { route: route.name });
    return false;
  }
  container.dispatch({
    ...CommonActions.navigate(route.name, route.params),
    target: rootKey,
  });
  return true;
}

/** For navigation triggered outside the navigator trees (notifications). */
export function useNavigateRoot() {
  const container = useContext(NavigationContainerRefContext);
  return useCallback(
    (route: { name: string; params?: object }) =>
      navigateRoot(container, route),
    [container]
  );
}

/**
 * Whether a root navigator is mounted, and a way to wait for one. Between the
 * two trees of a layout switch there is none, and navigation dispatched then
 * is dropped.
 */
export function useRootNavigatorMount() {
  const container = useContext(NavigationContainerRefContext);
  return useMemo(() => {
    const isMounted = () => container?.getRootState()?.key != null;
    const whenMounted = (listener: () => void) => {
      const unsubscribe = container?.addListener('state', () => {
        if (isMounted()) {
          unsubscribe?.();
          listener();
        }
      });
      // It may have mounted between the failed dispatch and this call.
      if (isMounted()) {
        unsubscribe?.();
        listener();
      }
    };
    return { isMounted, whenMounted };
  }, [container]);
}
