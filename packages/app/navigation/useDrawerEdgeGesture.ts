import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useEffect } from 'react';

import { drawerOwnsEdge } from './drawerDestination';

/**
 * Hands the left edge to the drawer on the screens it opens in their own
 * right, by taking it away from the stack's pop gesture there.
 *
 * Called by the screens that can be drawer destinations, for themselves: the
 * answer depends on what a route is sitting on, which the navigator's own
 * `options` cannot see — a screen's `navigation` there carries no usable state,
 * the same way a drawer screen's `route` carries none (see `AppDrawer`). A
 * screen mounted below the focused one asks about itself, not about whatever
 * is on top, so each passes its own key.
 *
 * This is the one writer of `gestureEnabled` for the screens that call it, and
 * has to be: `setOptions` is last-write-wins across a screen's effects, so a
 * second effect elsewhere in the same screen silently undoes this one.
 *
 * Android's system back is untouched; this is only the edge.
 */
export function useDrawerEdgeGesture(routeKey: string) {
  const navigation = useNavigation();
  const ownsEdge = useNavigationState((state) =>
    drawerOwnsEdge(state, routeKey)
  );

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !ownsEdge });
  }, [navigation, ownsEdge]);
}
